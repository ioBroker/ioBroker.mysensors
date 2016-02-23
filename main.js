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
var floatRegEx = /^[+-]?\d+(\.\d*)$/;

var config = {};

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
    if (devices[id] && devices[id].type == 'state') {
        if (typeof state.val === 'boolean') state.val = state.val ? 1 : 0;
        if (state.val === 'true')  state.val = 1;
        if (state.val === 'false') state.val = 0;

        mySensorsInterface.write(
            devices[id].native.id           + ';' +
            devices[id].native.childId      + ';1;0;' +
            devices[id].native.varTypeNum   + ';' +
            state.val, devices[id].native.ip);
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

function processPresentation(data, ip, port) {
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
        if (result[i].type === 'presentation' && result[i].subType) {
            presentationDone = true;
            var found = false;
            for (var n = 0; n < devices.length; n++) {
                if ((!ip || ip === devices[n].native.ip) &&
                    devices[n].native.id      == result[i].id      &&
                    devices[n].native.childId == result[i].childId &&
                    devices[n].native.subType == result[i].subType) {
                    found = true;
                    break;
                }
            }

            // Add new node
            if (!found) {
                var objs = getMeta(result[i], ip, port, config[ip || 'serial']);
                for (var j = 0; j < objs.length; j++) {
                    adapter.log.info('Add new object: ' + objs[j]._id + ' - ' + objs[j].common.name);
                    adapter.setObject(objs[j]._id, objs[j], function (err) {
                        if (err) adapter.log.error(err);
                    });
                }
            }
        } else {
            // try to convert value
            var val = result[i].payload;
            if (floatRegEx.test(val)) val = parseFloat(val);
            if (val === 'true')  val = true;
            if (val === 'false') val = false;
            result[i].payload = val;
        }
    }
    return result;
}
/*
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
*/
function main() {
    // read current existing objects
    adapter.getForeignObjects(adapter.namespace + '.*', 'state', function (err, states) {
        // subscribe on changes
        adapter.subscribeStates('*');
        adapter.subscribeObjects('*');
        devices = states;

        if (!devices[adapter.namespace + '.info.connection'] || !devices[adapter.namespace + '.info.connection'].common ||
            (devices[adapter.namespace + '.info.connection'].common.type === 'boolean' && adapter.config.type !== 'serial') ||
            (devices[adapter.namespace + '.info.connection'].common.type !== 'boolean' && adapter.config.type === 'serial')) {
            adapter.setForeignObject(adapter.namespace + '.info.connection', {
                "_id":  "info.connection",
                "type": "state",
                "common": {
                    "role":  "indicator.connected",
                    "name":  adapter.config.type === 'serial' ? 'If connected to my sensors' : 'List of connected gateways',
                    "type":  adapter.config.type === 'serial' ? 'boolean' : 'string',
                    "read":  true,
                    "write": false,
                    "def":   false
                },
                "native": {

                }
            }, function (err) {
                if (err) adapter.log.error(err);
            });
        }

        mySensorsInterface = new MySensors(adapter.config, adapter.log);

        // if object created
        if (mySensorsInterface) {
            mySensorsInterface.write('0;0;3;0;14;Gateway startup complete');

            // process received data
            mySensorsInterface.on('data', function (data, ip, port) {
                var result = processPresentation(data, ip, port); // update configuration if presentation received

                if (!result) return;

                for (var i = 0; i < result.length; i++) {
                    if (result[i].type === 'set') {
                        // If set quality
                        if (result[i].subType == 77) {
                            for (var id in devices) {
                                if (devices[id].native &&
                                    devices[id].native.id      == result[i].id &&
                                    devices[id].native.childId == result[i].childId) {
                                    adapter.log.debug('Set quality of ' + (devices[id].common.name || id) + ' ' + result[i].childId + ': ' + result[i].payload + ' ' + typeof result[i].payload);
                                    adapter.setState(id, {q: typeof result[i].payload}, true);
                                }
                            }
                        } else {
                            if (result[i].subType === 'V_LIGHT')  result[i].subType = 'V_STATUS';
                            if (result[i].subType === 'V_DIMMER') result[i].subType = 'V_PERCENTAGE';

                            for (var id in devices) {
                                //adapter.log.info(devices[id].native.varType + ' /// ' + result[i].subType);
                                if (devices[id].native &&
                                    devices[id].native.id      == result[i].id &&
                                    devices[id].native.childId == result[i].childId &&
                                    devices[id].native.varType == result[i].subType) {

                                    if (devices[id].common.type == 'boolean') result[i].payload = !!result[i].payload;
                                    adapter.log.debug('Set value ' + (devices[id].common.name || id) + ' ' + result[i].childId + ': ' + result[i].payload + ' ' + typeof result[i].payload);
                                    adapter.setState(id, result[i].payload, true);
                                    break;
                                }
                            }
                        }
                    } else if(result[i].type === 'internal') {
                        switch (result[i].subType) {
                            case 'I_BATTERY_LEVEL':     //	0	Use this to report the battery level (in percent 0-100).
                                adapter.log.info('Battery level ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);

                                // update battery value
                                for (var id in devices) {
                                    if (devices[id].native &&
                                        devices[id].native.id      == result[i].id &&
                                        devices[id].native.childId == result[i].childId &&
                                        devices[id].native.varType == 'I_BATTERY_LEVEL') {
                                        adapter.log.debug('Set value ' + (devices[id].common.name || id) + ' ' + result[i].childId + ': ' + result[i].payload + ' ' + typeof result[i].payload);
                                        adapter.setState(id, parseFloat(result[i].payload), true);
                                        break;
                                    }
                                }
                                break;

                            case 'I_TIME':              //	1	Sensors can request the current time from the Controller using this message. The time will be reported as the seconds since 1970
                                adapter.log.info('Time ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                if (!result[i].ack) {
                                    // send response
                                    mySensorsInterface.write(result[i].id + ';' + result[i].childId + ';3;1;' + Math.round(new Date().getTime() / 1000), ip);
                                }
                                break;

                            case 'I_VERSION':           //	2	Used to request gateway version from controller.
                                adapter.log.info('Version ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                if (!result[i].ack) {
                                    // send response
                                    mySensorsInterface.write(result[i].id + ';' + result[i].childId + ';3;1;' + (adapter.version || 0), ip);
                                }
                                break;

                            case 'I_INCLUSION_MODE':    //	5	Start/stop inclusion mode of the Controller (1=start, 0=stop).
                                adapter.log.info('inclusion mode ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload ? 'STARTED' : 'STOPPED');
                                break;

                            case 'I_CONFIG':            //	6	Config request from node. Reply with (M)etric or (I)mperal back to sensor.
                                adapter.log.info('Config ' + (ip ? ' from ' + ip + ' ': '') + ':' + (result[i].payload == 'M' ? 'Metric' : 'Imperial'));
                                config[ip || 'serial'] = result[i].payload == 'M' ? 'Metric' : 'Imperial';
                                break;

                            case 'I_LOG_MESSAGE':       //	9	Sent by the gateway to the Controller to trace-log a message
                                adapter.log.info('Log ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                break;

                            default:
                                adapter.log.info('Received INTERNAL message: ' + result[i].subType + ': ' + result[i].payload);
                        }
                    }
                }
            });

            mySensorsInterface.on('connectionChange', function (isConn, ip, port) {
                adapter.setState('info.connection', isConn, true);
                // try soft request
                if (!presentationDone) {
                    // request metric system
                    mySensorsInterface.write('0;0;3;0;6;', ip, port);
                    mySensorsInterface.write('0;0;0;0;0;force presentation', ip, port);
                    setTimeout(function () {
                        // send reboot command if still no presentation
                        if (!presentationDone) {
                            mySensorsInterface.write('0;0;3;0;13;force restart', ip, port);
                        }
                    }, 500);
                }
            });
        }
    });
}