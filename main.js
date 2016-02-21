/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils      = require(__dirname + '/lib/utils'); // Get common adapter utils
var serialport = require('serialport');//.SerialPort;
var Parses     = require('sensors');
var MySensors  = require(__dirname + '/lib/mysensors');
var getMeta    = require(__dirname + '/lib/getmeta').getMetaInfo;

var adapter   = utils.adapter('mysensors');
var devices   = {};
var mySensorsInterface;

//принимаем и обрабатываем сообщения 
adapter.on('message', function (obj) {
    if (obj) {
        switch (obj.command) {
            case 'listUart':
                if (obj.callback) {
                    // read all found serial ports
                    serialport.list(function (err, ports) {
                        adapter.log.info('List of port: ' + JSON.stringify(ports));
                        adapter.sendTo(obj.from, obj.command, ports, obj.callback);
                    });
                }

                break;
        }
    }
});

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        if (mySensorsInterface) mySensorsInterface.destroy();
        mySensorsInterface = null;
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    if (!state || state.ack || !mySensorsInterface) return;

    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // output to mysensors
    if (devices[id]) {
        mySensorsInterface.write(
            devices[id].native.id       + ';' +
            devices[id].native.childId  + ';1;0;' +
            devices[id].native.subType  + ';' +
            state.val);
    }
});

adapter.on('objectChange', function (id, obj) {
    if (!obj) {
        if (devices[id]) delete devices[id];
    } else {
        if (obj.native.id !== undefined && obj.native.childId !== undefined && obj.native.subType !== undefined) {
            devices[id] = obj;
        }
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

var presentationDone = false;

function processPresentation(data) {
    var result = Parses.parse(data.toString());

    //var result = [{
    //    id:       lineParts[0],
    //    childId:  lineParts[1],
    //    type:     Values.types[lineParts[2]],
    //    ack:      lineParts[3] === '1',
    //    payload:  lineParts[5]
    //    subType:  Values.subTypes[result.type][lineParts[4]];
    //}];

    if (!result || !result.length) {
        adapter.log.warn('Cannot parse data: ' + data);
        return null;
    }

    for (var i = 0; i < result.length; i++) {
        adapter.log.debug('Got: ' + JSON.stringify(result[i]));
        if (result[i].type === 'presentation') {
            var found = false;
            for (var n = 0; n < devices.length; n++) {
                if (devices[n].native.id      == result[i].id      &&
                    devices[n].native.childId == result[i].childId &&
                    ((result[i].subType === undefined && devices[n].native.subType === undefined) || devices[n].native.subType == result[i].subType)) {
                    found = true;
                    break;
                }
            }

            // Add new node
            if (!found) {
                var obj = getMeta(result[i]);
                adapter.log.info('Add new object: ' + obj._id + ' - ' + obj.common.name);
                adapter.setObject(obj._id, obj, function (err) {
                    if (err) adapter.log.error(err);
                });
            }
        } else {
            // try to convert value
            var val = result[i].payload;
            if (val.match(/^[+-]\d+(\.\d*)$/)) val = parseFloat(val);
            if (val === 'true')  val = true;
            if (val === 'false') val = false;
            result[i].payload = val;
        }
    }
    return result;
}

function syncObjects(index, cb) {
    if (typeof index === 'function') {
        cb = index;
        index = 0;
    }

    index = index || 0;

    if (!adapter.config.devices || index >= adapter.config.devices.length) {
        cb && cb();
        return;
    }

    var id = adapter.config.devices[index].name.replace(/[.\s]+/g, '_');


    adapter.getObject(id, function (err, obj) {
        if (err) adapter.log.error(err);

        // if new or changed
        if (!obj || JSON.stringify(obj.native) !== JSON.stringify(adapter.config.devices[index])) {
            adapter.setObject(id, {
                common: {
                    name: adapter.config.devices[index].name,
                    def: false,
                    type: 'boolean', // нужный тип надо подставить
                    read: 'true',
                    write: 'true',   // нужный режим надо подставить
                    role: 'state',
                    desc: obj ? obj.common.desc : 'Variable from mySensors'
                },
                type: 'state',
                native: adapter.config.devices[index]
            }, function (err) {
                // Sync Rooms
                adapter.deleteStateFromEnum('rooms', '', '', id, function () {
                    if (adapter.config.devices[index].room) {
                        adapter.addStateToEnum('rooms', adapter.config.devices[index].room, '', '', id);
                    }
                });

                if (err) adapter.log.error(err);
                if (!obj) {
                    adapter.log.info('Create state ' + id);

                    // if new object => create state
                    adapter.setState(id, null, true, function () {
                        setTimeout(function () {
                            syncObjects(index + 1, cb);
                        }, 0);
                    });
                } else {
                    adapter.log.info('Update state ' + id);
                    setTimeout(function () {
                        syncObjects(index + 1, cb);
                    }, 0);
                }
            });
        } else {
            setTimeout(function () {
                syncObjects(index + 1, cb);
            }, 0);
        }
    });
}

function deleteStates(states, cb) {
    if (!states || !states.length) {
        cb && cb();
        return;
    }
    var id = states.pop();
    adapter.log.info('Delete state ' + id);
    adapter.delForeignObject(id, function (err) {
        adapter.deleteStateFromEnum('rooms', '', '', id);

        if (err) adapter.log.error(err);

        adapter.delForeignState(id, function (err) {
            if (err) adapter.log.error(err);

            setTimeout(function () {
                deleteStates(states, cb);
            }, 0);
        })
    });
}

function main() {
    // read current existing objects
    adapter.getForeignObjects(adapter.namespace + '.*', 'state', function (err, states) {
        // subscribe on changes
        adapter.subscribeStates('*');
        devices = states;

        mySensorsInterface = new MySensors(adapter.config, adapter.log);

        // if object created
        if (mySensorsInterface) {
            mySensorsInterface.write('0;0;3;0;14;Gateway startup complete');

            // process received data
            mySensorsInterface.on('data', function (data) {
                var result = processPresentation(data); // update configuration if presentation received

                for (var i = 0; i < result.length; i++) {
                    if (result[i].type == 'set' || result[i].type == 'req') {
                        for (var id in devices) {
                            if (devices[id].native.subType === result[i].subType &&
                                devices[id].native.id      === result[i].id      &&
                                devices[id].native.childId === result[i].childId) {
                                adapter.setState(id, result[i].payload, true);
                                break;
                            }
                        }
                    }
                }
            });

            mySensorsInterface.on('connectionChange', function (isConn) {
                adapter.setState('info.connection', isConn, true);
                if (!presentationDone) {
                    mySensorsInterface.write('0;0;3;0;13;force presentation');
                }
            });
        }
    });
}