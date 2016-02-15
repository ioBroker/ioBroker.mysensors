/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

var adapter   = utils.adapter('mysensors');
var stopTimer = null;

var Sensors    = require('sensors');
var serialport = require('serialport');//.SerialPort;
var SerialPort  = serialport.SerialPort;
var portConfig = {baudRate: 115200,	parser: serialport.parsers.readline('\n')};

//принимаем и обрабатываем сообщения 
adapter.on('message', function (obj) {
	if (obj) {
        switch (obj.command) {
            case 'list_uart':
                //ToDo отдать список портов
                serialport.list(function (err, ports) {
                    if (obj.callback) {
                        adapter.log.info('obj.callback...ToDo выслать список СОМ портов');
                        adapter.sendTo(obj.from, obj.command, ports, obj.callback);
                    }
                });
                break;

            case 'list_dbsU'://ToDo отдать список юнитов
                    if (obj.callback) {
                        adapter.log.info('obj.callback...ToDo выслать список юнитов');
                        adapter.sendTo(obj.from, obj.command, dbsUnique, obj.callback);
                    }
		        break;
		}
	}
});

var host  = ''; // название машины где подключен шлюз
var mysdevs = []; // список устройств mysensor

function pingAll() {
   adapter.log.debug('Ping-all' + adapter.config.comlst);
    
   if (stopTimer) clearTimeout(stopTimer);

    var count = mysdevs.length;
    adapter.log.debug('count-' + mysdevs.length);

    mysdevs.forEach(function (_mysdevice) {
        adapter.log.debug('tada-- ' + _mysdevice);
    });
}

function createState(name, ip, room, callback) {
   // var id = ip.replace(/[.\s]+/g, '_');

    // if (room) {
        // adapter.addStateToEnum('room', room, '', host, id);
    // }

    // adapter.createState('', host, id, {
        // name:   name || ip,
        // def:    false,
        // type:   'boolean',
        // read:   'true',
        // write:  'false',
        // role:   'indicator.reachable',
        // desc:   'Ping state of ' + ip
    // }, {
        // ip: ip
    // }, callback);
}

function addState(name, ip, room, callback) {
    adapter.getObject(host, function (err, obj) {
        if (err || !obj) {
            // if root does not exist, channel will not be created
            adapter.createChannel('', host, [], function () {
                createState(name, ip, room, callback);
            });
        } else {
            createState(name, ip, room, callback);
        }
    });
}

function syncConfig() {
    adapter.getStatesOf('', host, function (err, _states) {
        var configToDelete = [];
        var configToAdd    = [];
        var k;
        var id;
        if (adapter.config.devices) {
            for (k = 0; k < adapter.config.devices.length; k++) {
                configToAdd.push(adapter.config.devices[k].name);
            }
        }

        if (_states) {
            for (var j = 0; j < _states.length; j++) {
                var ip = _states[j].native.ip;
                id = ip.replace(/[.\s]+/g, '_');
                var pos = configToAdd.indexOf(ip);
                if (pos != -1) {
                    configToAdd.splice(pos, 1);
                    // Check name and room
                    for (var u = 0; u < adapter.config.devices.length; u++) {
                        if (adapter.config.devices[u].ip == ip) {
                            if (_states[j].common.name != (adapter.config.devices[u].name || adapter.config.devices[u].ip)) {
                                adapter.extendObject(_states[j]._id, {common: {name: (adapter.config.devices[u].name || adapter.config.devices[u].ip)}});
                            }
                            if (adapter.config.devices[u].room) {
                                adapter.addStateToEnum('room', adapter.config.devices[u].room, '', host, id);
                            } else {
                                adapter.deleteStateFromEnum('room', '', host, id);
                            }
                        }
                    }
                } else {
                    configToDelete.push(ip);
                }
            }
        } 

        if (configToAdd.length) {
            for (var r = 0; r < adapter.config.devices.length; r++) {
                if (configToAdd.indexOf(adapter.config.devices[r].ip) != -1) {
                    addState(adapter.config.devices[r].name, adapter.config.devices[r].ip, adapter.config.devices[r].room);
                }
            }
        }
        if (configToDelete.length) {
            for (var e = 0; e < configToDelete.length; e++) {
                id = configToDelete[e].replace(/[.\s]+/g, '_');
                adapter.deleteStateFromEnum('room', '',  host, id);
                adapter.deleteState('', host, id);
            }
        }
    });
}

// is called when adapter shuts down - callback has to be called under any circumstances!
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

// is called if a subscribed state changes
adapter.on( 'stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
}); 

var dbsUnique=[];//будут хранится уникальные посылки от всех юнитов, из ком порта
//  ---------------------------------------------------------
//  node-id; child-sensor-id; message-type; ack; sub-type; payload\n
//  ---------------------------------------------------------
function mkdbmsgUnique( str ) {
   var valcsv=str.split( ";" ); //элементы строки лога
   var fl=false;
    adapter.log.info("количество сообщений "+dbsUnique.length);
   for( var n = 0 ; n < dbsUnique.length; n ++ ){
     
      if(   dbsUnique[n].NodeId==valcsv[0]	&&
            dbsUnique[n].ChildId==valcsv[1]	&&
            dbsUnique[n].MsgType==valcsv[2]	&&			
            dbsUnique[n].Data_type==valcsv[4]
      ){
         // dbsUnique[n].==valcsv[3] &&
         // dbsUnique[n].==valcsv[4] &&
         // dbsUnique[n].==valcsv[5] &&
         // dbsUnique[n].==valcsv[6]    //sub-type
         fl=true
		 dbsUnique[n].Value=valcsv[5];//todo сравнить с олд вал и изменить стейт
      }
   }
   if ( fl==false &&  valcsv[1]!=="0" )//не добавляем ноду шлюза
   {
      dbsUnique.push(
      {
         "NodeId":		valcsv[0],
         "ChildId":		valcsv[1],
         "MsgType":		valcsv[2],
         "Ack":			valcsv[3],
         "Data_type":	valcsv[4],
         "Value":		valcsv[5],
         
      }
      );

     // tree.push( str );
   }
}
function main() {
    host = adapter.host;

    for (var i = 0; i < adapter.config.devices.length; i++) {
        mysdevs.push(adapter.config.devices[i].name);
    }

    if (adapter.config.interval < 5000) adapter.config.interval = 5000;

    syncConfig();

    //------------------------------------------------------------------	
    
	adapter.log.debug('Communication port:' + adapter.config.comName);

	// open the serial port:
	if (adapter.config.comName) {
        var myPort = new SerialPort(adapter.config.comName, portConfig);

        // ловим события порта
        myPort.on('data', function(data) {
            mkdbmsgUnique(data); //пишем в массив уникальных сообщений
			var result = Sensors.parse(data.toString());

            for(var i in result) {
                adapter.log.info('__' +
                    result[i].id      + '_|_' +
                    result[i].childId + '_|_' +
                    result[i].type    + '_|_' +
                    result[i].ack     + '_|_' +
                    result[i].subType + '_|_' +
                    result[i].payload);
            }
        });
	}

    //-----------------------------------------------------------------
    //	myPort.write("1;1;1;1;3;0\n");
    //	myPort.write("2;1;1;1;2;1\n");
    //    pingAll();
    //  timer = setInterval(pingAll, adapter.config.interval);
}