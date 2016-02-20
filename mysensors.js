/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

var adapter   = utils.adapter('mysensors');
var stopTimer = null;

var Sensors    = require('sensors');
var serialport = require('serialport');//.SerialPort;
var SerialPort = serialport.SerialPort;
var portConfig = {baudRate: 115200,	parser: serialport.parsers.readline('\n')};
var G_myPort;
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

var mysdevs = []; // список устройств mysensor

function pingAll() {
   adapter.log.info('Ping-all' + adapter.config.comlst);
    
   if (stopTimer) clearTimeout(stopTimer);

    var count = mysdevs.length;
    adapter.log.info('count-' + mysdevs.length);

    mysdevs.forEach(function (_mysdevice) {
        adapter.log.info('tada-- ' + _mysdevice);
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
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    
    if (!state && state.ack) return;
    
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));
	
	
	//________________выводим в порт___________________________________________
		for (var co = 0; co < adapter.config.devices.length; co++) {		
			if (id == adapter.namespace + '.' + adapter.config.devices[co].name) {
				var msg_s =	adapter.config.devices[co].raw	+ ';' +	state.val + '\n';
				G_myPort.write(msg_s);
				adapter.log.info('mesage-'+msg_s); 				
			}  
			adapter.log.info(adapter.config.devices[co].name+ ';' + adapter.config.devices[co].node_id)		
		}
	
 	//----------------------------------------------------------------------------  
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

var dbsUnique = [];//будут хранится уникальные посылки от всех юнитов, из ком порта
//  ---------------------------------------------------------
//  node-id; child-sensor-id; message-type; ack; sub-type; payload\n
//  ---------------------------------------------------------
function mkdbmsgUnique(str) {
    var valcsv = str.split( ";" ); //элементы строки лога
    var fl = false;

    var result = Sensors.parse(str.toString());
    if (!result || !result.length) {
    	adapter.log.warn('Cannot parse data: ' + str);
    	return null;
    }
	var i = 0;	
	var raw = valcsv[0] + ';' + valcsv[1] + ';' + valcsv[2] + ';' + valcsv[3] + ' ;' + valcsv[4];
	valcsv[0] = result[i].id ;
    valcsv[1] = result[i].childId ;
    valcsv[2] = result[i].type ;
    valcsv[3] = result[i].ack  ;
    valcsv[4] = result[i].subType ;
    valcsv[5] = result[i].payload;
	
		
	adapter.log.debug("number of messages: " + dbsUnique.length);
    for (var n = 0; n < dbsUnique.length; n++) {

        if (dbsUnique[n].NodeId    == valcsv[0]	&&
            dbsUnique[n].ChildId   == valcsv[1]	&&
            dbsUnique[n].MsgType   == valcsv[2]	&&
            dbsUnique[n].Data_type == valcsv[4]
        ){
         // dbsUnique[n].==valcsv[3] &&
         // dbsUnique[n].==valcsv[4] &&
         // dbsUnique[n].==valcsv[5] &&
         // dbsUnique[n].==valcsv[6]    //sub-type
         fl = true;
         dbsUnique[n].Value = valcsv[5];//todo сравнить с олд вал и изменить стейт
        }
    }
  //  if (fl == false && valcsv[0] !== "0"){//не добавляем ноду шлюза
    if (fl == false ){//не добавляем ноду шлюза       
	   dbsUnique.push({
            "NodeId":		valcsv[0],
            "ChildId":		valcsv[1],
            "MsgType":		valcsv[2],
            "Ack":			valcsv[3],
            "Data_type":	valcsv[4],
            "Value":		valcsv[5],
            "raw":			raw			
        });

    // tree.push( str );
    }
    return result;
}

function syncObjects(index, cb) {
    if (typeof index === 'function') {
        cb    = index;
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
                    def:  false,
                    type: 'boolean', // нужный тип надо подставить
                    read: 'true',
                    write:'true',   // нужный режим надо подставить
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
				
				// подписываемся на изменения извне
             	adapter.subscribeStates('*');
				
				
                for (var i = 0; i < adapter.config.devices.length; i++) {
                    mysdevs.push(adapter.config.devices[i].name);
                }
                //------------------------------------------------------------------

                adapter.log.debug('Communication port:' + adapter.config.comName);

                // open the serial port:
                if (adapter.config.comName) {
                    var myPort = new SerialPort(adapter.config.comName, portConfig);
					G_myPort=myPort;
                    // ловим события порта
                    myPort.on('data', function(data) {
                    adapter.log.info('Rx-Raw  '+data);  
					var tmp= data.split( ";" );

					if (tmp.length < 6) {
	                    adapter.log.info('raw_data_error ' + tmp.length);  									
					} else {
					   if (!data) {
					   		adapter.log warn('Invalid data: null');
					   		return;
					   }					   
					   
					   var result = mkdbmsgUnique(data); //пишем в массив уникальных сообщений
					   if (!result) {
					   		adapter.log warn('Cannot parse: ' + data);
					   		return;
					   }

//___________________________Устанавливаем значение переменной по имени из ком порта____________________________________________
						for (var co = 0; co < adapter.config.devices.length; co++) {		
							if ( 	  result[0].subType + 
								'_' + result[0].id  + 
								'_' + result[0].childId	== adapter.config.devices[co].name){
								adapter.setState(adapter.config.devices[co].name, result[0].payload, true); 				
							}  
						}
//------------------------------------------------------------------------------------------------------------------------------


					   for(var i in result) {
                            adapter.log.info('__' +
                                result[i].id      + '_|_' +
                                result[i].childId + '_|_' +
                                result[i].type    + '_|_' +
                                result[i].ack     + '_|_' +
                                result[i].subType + '_|_' +
                                result[i].payload);
						}
						
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
