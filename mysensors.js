/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils      = require(__dirname + '/lib/utils'); // Get common adapter utils
var serialport = require('serialport');//.SerialPort;
var Parses     = require('sensors');
var MySensors  = require(__dirname + '/lib/mysensors');

var adapter   = utils.adapter('mysensors');
var stopTimer = null;


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

            case 'listUnits':
                // Read list of nodes
                if (obj.callback) {
                    if (mySensorsInterface) {
                        mySensorsInterface.write('0;0;0;0;0;0');
                        setTimeout(function () {
                            adapter.log.info('dbsUnique: ' + dbsUnique.length);
                            adapter.sendTo(obj.from, obj.command, dbsUnique, obj.callback);
                        }, 2000);
                    } else {
                        adapter.log.warn('No open connection');
                    }
                }
                break;
        }
    }
});

var mysdevs = []; // список устройств mysensor

/*
function pingAll() {
    adapter.log.info('Ping-all' + adapter.config.comlst);

    if (stopTimer) clearTimeout(stopTimer);

    var count = mysdevs.length;
    adapter.log.info('count-' + mysdevs.length);

    mysdevs.forEach(function (_mysdevice) {
        adapter.log.info('tada-- ' + _mysdevice);
    });
}
*/
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
    for (var co = 0; co < adapter.config.devices.length; co++) {
        if (id == adapter.namespace + '.' + adapter.config.devices[co].name) {
            var sMsg = adapter.config.devices[co].raw + ';' + state.val;
            mySensorsInterface.write(sMsg);
        }
    }
});


// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});

var dbsUnique = []; //  будут хранится уникальные посылки от всех юнитов, из ком порта
//  ---------------------------------------------------------
//  node-id; child-sensor-id; message-type; ack; sub-type; payload\n
//  ---------------------------------------------------------
function mkdbmsgUnique(str) {
    var result = Parses.parse(str.toString());

    //var result = [{
    //    id:       lineParts[0],
    //    childId:  lineParts[1],
    //    type:     Values.types[lineParts[2]],
    //    ack:      lineParts[3] === '1',
    //    payload:  lineParts[5]
    //    subType:  Values.subTypes[result.type][lineParts[4]];
    //}];
    
    if (!result || !result.length) {
        adapter.log.warn('Cannot parse data: ' + str);
        return null;
    }
    
    for (var i = 0; i < result.length; i++) {
        var found = false;
        result[i].raw = result[i].id + ';' + result[i].childId + ';' + result[i].type + ';' + result[i].ack + ';' + result[i].subType;

        // try to convert value
        var val = result[i].payload;
        var f = parseFloat(val);
        if (f.toString() === val) val = f;
        if (val === 'true')  val = true;
        if (val === 'false') val = false;
        result[i].payload = val;

        for (var n = 0; n < dbsUnique.length; n++) {
            // why here no compare with ack?
            if (dbsUnique[n].id         == result[i].id         &&
                dbsUnique[n].childId    == result[i].childId    &&
                dbsUnique[n].subType    == result[i].subType) {
                found = true;
                dbsUnique[n].payload = result[i].payload;
            }
        }

        // Add new node
        if (!found) {
            result[i].dataType = typeof result[i].payload;
            dbsUnique.push(result[i]);
            adapter.log.debug('Number of messages ' + dbsUnique.length);
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
    adapter.config.devices = adapter.config.devices || [];
    // read current existing objects
    adapter.getForeignObjects(adapter.namespace + '.*', 'state', function (err, states) {
        var toDelete = [];

        // delete non existing objects
        for (var id in states) {
            var isFound = false;
            for (var i2 = 0; i2 < adapter.config.devices.length; i2++) {
                if (adapter.config.devices[i2].name === states[id].common.name) {
                    isFound = true;
                    break;
                }
            }
            if (!isFound) toDelete.push(id);
        }

        // delete non existing states
        deleteStates(toDelete, function () {
            // create new or modified states
            syncObjects(function () {

                // subscribe on changes
                adapter.subscribeStates('*');

                for (var i = 0; i < adapter.config.devices.length; i++) {
                    mysdevs.push(adapter.config.devices[i].name);
                }

                adapter.log.debug('Communication port: ' + adapter.config.comName);

                mySensorsInterface = new MySensors(adapter.config, adapter.log);

                // open the serial port:
                if (mySensorsInterface) {
                    // process received data
                    mySensorsInterface.on('data', function (data) {
                        var result = mkdbmsgUnique(data); // write to unique nodes

                        for (var i = 0; i < result.length; i++) {
                            for (var co = 0; co < adapter.config.devices.length; co++) {
                                if (result[i].subType + '_' + result[i].id + '_' + result[i].childId == adapter.config.devices[co].name) {
                                    adapter.setState(adapter.config.devices[co].name, result[i].payload, true);
                                }
                            }

                            adapter.log.debug(JSON.stringify(result[i]));
                        }
                    });
                }

                //-----------------------------------------------------------------
                //	myPort.write("1;1;1;1;3;0\n");
                //	myPort.write("2;1;1;1;2;1\n");
                //    pingAll();
                //  timer = setInterval(pingAll, adapter.config.interval);
            });
        });
    });

    if (adapter.config.interval < 5000) adapter.config.interval = 5000;
}