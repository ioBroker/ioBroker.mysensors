/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils      = require(__dirname + '/lib/utils'); // Get common adapter utils
var serialport;
var Parses     = require('sensors');
var MySensors  = require(__dirname + '/lib/mysensors');
var getMeta    = require(__dirname + '/lib/getmeta').getMetaInfo;
var getMeta2   = require(__dirname + '/lib/getmeta').getMetaInfo2;

var adapter   = utils.adapter('mysensors');
var devices   = {};
var mySensorsInterface;
var floatRegEx = /^[+-]?\d+(\.\d*)$/;
var inclusionOn = false;
var inclusionTimeout = false;

var config = {};

try {
    serialport = require('serialport');//.SerialPort;
} catch (e) {
    console.warn('Serial port is not available');
}

//принимаем и обрабатываем сообщения
adapter.on('message', function (obj) {
    if (obj) {
        switch (obj.command) {
            case 'listUart':
                if (obj.callback) {
                    if (serialport) {
                        // read all found serial ports
                        serialport.list(function (err, ports) {
                            adapter.log.info('List of port: ' + JSON.stringify(ports));
                            adapter.sendTo(obj.from, obj.command, ports, obj.callback);
                        });
                    } else {
                        adapter.log.warn('Module serialport is not available');
                        adapter.sendTo(obj.from, obj.command, [{comName: 'Not available'}], obj.callback);
                    }
                }

                break;
        }
    }
});

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    adapter.setState('info.connection', false, true);
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

    if (id === adapter.namespace + '.inclusionOn') {
        setInclusionState(state.val);
    } else
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

adapter.on('ready', function () {
    main();
});

var presentationDone = false;

function setInclusionState(val) {
    val = val === 'true' || val === true || val === 1 || val === '1';
    inclusionOn = val;

    if (inclusionTimeout) clearTimeout(inclusionTimeout);
    inclusionTimeout = null;

    if (inclusionOn && adapter.config.inclusionTimeout) {
        inclusionTimeout = setTimeout(function () {
            inclusionOn = false;
            adapter.setState('inclusionOn', false, true);
        }, adapter.config.inclusionTimeout);
    }
}


function findDevice(result, ip, subType) {
    for (var id in devices) {
        if (devices[id].native &&
            (!ip || ip == devices[id].native.ip) &&
            devices[id].native.id == result.id &&
            devices[id].native.childId == result.childId &&
            (subType === false || devices[id].native.varType == result.subType)) {
            return id;
        }
    }
    return -1;
}


function saveResult(id, result, ip, subType) {
    if (id == -1) id = findDevice(result, ip, subType);
    if (id != -1 && devices[id]) {
        if (devices[id].common.type == 'boolean') {
            result.payload = result.payload === 'true' || result.payload === true || result.payload === '1' || result.payload === 1;
            //result.payload = !!result[i].payload;
        }
        if (devices[id].common.type == 'number')  result.payload = parseFloat(result.payload);

        adapter.log.debug('Set value ' + (devices[id].common.name || id) + ' ' + result.childId + ': ' + result.payload + ' ' + typeof result.payload);
        adapter.setState(id, result.payload, true);

        return id;
    }
    return 0;
}


function processPresentation(data, ip, port) {
    data = data.toString();

    var result;
    try {
        result = Parses.parse(data);
    } catch (e) {
        adapter.log.error('Cannot parse data: ' + data + '[' + e + ']');
        return null;
    }

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
            adapter.log.debug('Message presentation');
            presentationDone = true;
            var found = findDevice(result[i], ip) != -1;
            // Add new node
            if (!found) {
                if (inclusionOn) {
                    adapter.log.debug('ID not found. Try to add to to DB');
                    var objs = getMeta(result[i], ip, port, config[ip || 'serial']);
                    for (var j = 0; j < objs.length; j++) {
                        adapter.log.debug('Check ' + devices[adapter.namespace + '.' + objs[j]._id]);
                        if (!devices[adapter.namespace + '.' + objs[j]._id]) {
                            devices[adapter.namespace + '.' + objs[j]._id] = objs[j];
                            adapter.log.info('Add new object: ' + objs[j]._id + ' - ' + objs[j].common.name);
                            adapter.setObject(objs[j]._id, objs[j], function (err) {
                                if (err) adapter.log.error(err);
                            });
                        }
                    }
                } else {
                    adapter.log.warn('ID not found. Inclusion mode OFF: ' + JSON.stringify(result[i]));
                }
            }
            // check if received object exists
        } else if (result[i].type === 'set' && result[i].subType) {
            if (0) {
                adapter.log.debug('Message type is "set". Try to find it in DB...');
                var found = false;
                var foundObjID; // store here ID that suit with parameters to id and childId

                for (var id in devices) {
                    if ((!ip || ip === devices[id].native.ip) &&
                        devices[id].native.id      == result[i].id      &&
                        devices[id].native.childId == result[i].childId &&
                        devices[id].native.varType == result[i].subType) {
                        found = true;
                        adapter.log.debug('Found id = ' + id);
                        break;
                    }
                    if (devices[id].native.id      == result[i].id      &&
                        devices[id].native.childId == result[i].childId){
                        foundObjID = id;
                        adapter.log.debug('Save foundObjID with similar id and childId');
                        adapter.log.debug('devices[foundObjID].native.id      = ' + devices[foundObjID].native.id);
                        adapter.log.debug('devices[foundObjID].native.childId = ' + devices[foundObjID].native.childId);
                    }
                }

                // add new value to existing object
                if (!found && foundObjID) {
                    adapter.log.debug('Object ID: ' + result[i].id + ', childId: ' + result[i].childId + ', subType: ' + result[i].subType + ' not found!');
                    if (inclusionOn) {
                        adapter.log.debug('ID not found. Try to add to to DB');
                        var common_name = devices[foundObjID].common.name.split('.');
                        var objs = getMeta2(result[i], ip, port, config[ip || 'serial'], devices[foundObjID].native.subType, common_name[0]);
                        if (!devices[adapter.namespace + '.' + objs[0]._id]) {
                            devices[adapter.namespace + '.' + objs[0]._id] = objs[0];
                            adapter.log.info('Add new object: ' + objs[0]._id + ' - ' + objs[0].common.name);
                            adapter.setObject(objs[0]._id, objs[0], function (err) {
                                if (err) adapter.log.error(err);
                            });
                        }
                    } else {
                        adapter.log.warn('ID not found. Inclusion mode OFF: ' + JSON.stringify(result[i]));
                    }
                } else {
                    if (!found && !foundObjID) {
                        adapter.log.debug('Object ID: ' + result[i].id + ', childId: ' + result[i].childId + ' not found!');
                    }
                }
            }
            // try to convert value
            var val = result[i].payload;
            if (floatRegEx.test(val)) val = parseFloat(val);
            if (val === 'true')  val = true;
            if (val === 'false') val = false;
            result[i].payload = val;

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

function d
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
    adapter.getState('inclusionOn', function (err, state) {
        setInclusionState(state ? state.val : false);
    });

    // read current existing objects (прочитать текущие существующие объекты)
    adapter.getForeignObjects(adapter.namespace + '.*', 'state', function (err, states) {
        // subscribe on changes
        adapter.subscribeStates('*');
        adapter.subscribeObjects('*');
        devices = states;

        if (!devices[adapter.namespace + '.info.connection'] || !devices[adapter.namespace + '.info.connection'].common ||
            (devices[adapter.namespace + '.info.connection'].common.type === 'boolean' && adapter.config.type !== 'serial') ||
            (devices[adapter.namespace + '.info.connection'].common.type !== 'boolean' && adapter.config.type === 'serial')) {
            adapter.setForeignObject(adapter.namespace + '.info.connection', {
                _id:  'info.connection',
                type: 'state',
                common: {
                    role:  'indicator.connected',
                    name:  adapter.config.type === 'serial' ? 'If connected to my sensors' : 'List of connected gateways',
                    type:  adapter.config.type === 'serial' ? 'boolean' : 'string',
                    read:  true,
                    write: false,
                    def:   false
                },
                native: {

                }
            }, function (err) {
                if (err) adapter.log.error(err);
            });
        }

        mySensorsInterface = new MySensors(adapter.config, adapter.log, function (error) {
            // if object created
            mySensorsInterface.write('0;0;3;0;14;Gateway startup complete');

            // process received data
            mySensorsInterface.on('data', function (data, ip, port) {
                var result = processPresentation(data, ip, port); // update configuration if presentation received

                if (!result) return;

                for (var i = 0; i < result.length; i++) {
                    adapter.log.debug('Message type: ' + result[i].type);
                    var id = findDevice(result[i], ip);
                    if (result[i].type === 'set') {
                        // If set quality
                        if (result[i].subType == 77) {
                            adapter.log.debug('subType = 77');
                            for (var id in devices) {
                                if (devices[id].native &&
                                    (!ip || ip == devices[id].native.ip) &&
                                    devices[id].native.id      == result[i].id &&
                                    devices[id].native.childId == result[i].childId) {
                                    adapter.log.debug('Set quality of ' + (devices[id].common.name || id) + ' ' + result[i].childId + ': ' + result[i].payload + ' ' + typeof result[i].payload);
                                    adapter.setState(id, {q: typeof result[i].payload}, true);
                                }
                            }
                        } else {
                            if (result[i].subType === 'V_LIGHT')  result[i].subType = 'V_STATUS';
                            if (result[i].subType === 'V_DIMMER') result[i].subType = 'V_PERCENTAGE';
                            if (result[i].subType === 'V_DUST_LEVEL') result[i].subType = 'V_LEVEL';

                            saveResult(id, result[i], ip, true);
                        }
                    } else if(result[i].type === 'internal') {
                        var saveValue = false;
                        switch (result[i].subType) {
                            case 'I_BATTERY_LEVEL':     //   0   Use this to report the battery level (in percent 0-100).
                                adapter.log.info('Battery level ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                saveValue = true;
                                break;

                            case 'I_TIME':              //   1   Sensors can request the current time from the Controller using this message. The time will be reported as the seconds since 1970
                                adapter.log.info('Time ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                if (!result[i].ack) {
                                    // send response: internal, ack=1
                                    mySensorsInterface.write(result[i].id + ';' + result[i].childId + ';3;1;' + result[i].subType + ';' + Math.round(new Date().getTime() / 1000), ip);
                                }
                                break;

                            case 'I_SKETCH_VERSION':
                            case 'I_VERSION':           //   2   Used to request gateway version from controller.
                                adapter.log.info('Version ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                saveValue = true;
                                if (!result[i].ack && result[i].subType === 'I_VERSION') {
                                    // send response: internal, ack=1
                                    mySensorsInterface.write(result[i].id + ';' + result[i].childId + ';3;1;' + result[i].subType + ';' + (adapter.version || 0), ip);
                                }
                                break;

                            case 'I_SKETCH_NAME':           //   2   Used to request gateway version from controller.
                                adapter.log.info('Name  ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                var name = result[i].payload;
                                var _id = result[i].id;
                                adapter.getObject(_id, function(err, obj) {
                                    if(!obj) {
                                        obj = { type: 'device', common: { name: name }}
                                    } else if (obj.common.name === name) {
                                        return;
                                    }
                                    obj.common.name = name;
                                    adapter.setObject(adapter.namespace + '.' + _id, obj, function (err) {
                                    });
                                });
                                saveValue = true;
                                break;

                            case 'I_INCLUSION_MODE':    //   5   Start/stop inclusion mode of the Controller (1=start, 0=stop).
                                adapter.log.info('inclusion mode ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload ? 'STARTED' : 'STOPPED');
                                break;

                            case 'I_CONFIG':            //   6   Config request from node. Reply with (M)etric or (I)mperal back to sensor.
                                result[i].payload = (result[i].payload == 'I') ? 'Imperial' : 'Metric';
                                adapter.log.info('Config ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                config[ip || 'serial'] = config[ip || 'serial'] || {};
                                config[ip || 'serial'].metric = result[i].payload;
                                saveValue = true;
                                break;

                            case 'I_LOG_MESSAGE':       //   9   Sent by the gateway to the Controller to trace-log a message
                                adapter.log.info('Log ' + (ip ? ' from ' + ip + ' ': '') + ':' + result[i].payload);
                                break;

                            case 'I_ID_REQUEST':
                                if (inclusionOn) {
                                    // find maximal index
                                    var maxId = 0;
                                    for (var id in devices) {
                                        if (devices[id].native && (!ip || ip == devices[id].native.ip) &&
                                            devices[id].native.id > maxId) {
                                            maxId = devices[id].native.id;
                                        }
                                    }
                                    maxId++;
                                    if (!result[i].ack) {
                                        // send response: internal, ack=0, I_ID_RESPONSE
                                        mySensorsInterface.write(result[i].id + ';' + result[i].childId + ';3;0;4;' + maxId, ip);
                                    }
                                } else {
                                    adapter.log.warn('Received I_ID_REQUEST, but inclusion mode is disabled');
                                }
                                break;

                            default:
                                adapter.log.info('Received INTERNAL message: ' + result[i].subType + ': ' + result[i].payload);

                        }

                        if (saveValue) {
                            saveResult(id, result[i], ip, true);
                        }
                    } else if(result[i].type === 'stream') {
                        switch (result[i].subType) {
                            case 'ST_FIRMWARE_CONFIG_REQUEST':
                                break;
                            case 'ST_FIRMWARE_CONFIG_RESPONSE':
                                break;
                            case 'ST_FIRMWARE_REQUEST':
                                break;
                            case 'ST_FIRMWARE_RESPONSE':
                                break;
                            case 'ST_SOUND':
                                break;
                            case 'ST_IMAGE':
                                break;
                        }
                    }

                }
            });

            mySensorsInterface.on('connectionChange', function (isConn, ip, port) {
                adapter.setState('info.connection', isConn, true);
                // try soft request
                if (!presentationDone && isConn) {
                    // request metric system
                    mySensorsInterface.write('0;0;3;0;6;get metric', ip, port);
                    mySensorsInterface.write('0;0;3;0;19;force presentation', ip, port);
                    setTimeout(function () {
                        // send reboot command if still no presentation
                        if (!presentationDone) {
                            mySensorsInterface.write('0;0;3;0;13;force restart', ip, port);
                        }
                    }, 1500);
                }
            });
        });
    });
}