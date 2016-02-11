/**
 *
 * template adapter
 *
 *
 *  file io-package.json comments:
 *
 *  {
 *      "common": {
 *          "name":         "template",                  // name has to be set and has to be equal to adapters folder name and main file name excluding extension
 *          "version":      "0.0.0",                    // use "Semantic Versioning"! see http://semver.org/
 *          "title":        "Node.js template Adapter",  // Adapter title shown in User Interfaces
 *          "authors":  [                               // Array of authord
 *              "name <mail@template.com>"
 *          ]
 *          "desc":         "template adapter",          // Adapter description shown in User Interfaces. Can be a language object {de:"...",ru:"..."} or a string
 *          "platform":     "Javascript/Node.js",       // possible values "javascript", "javascript/Node.js" - more coming
 *          "mode":         "daemon",                   // possible values "daemon", "schedule", "subscribe"
 *          "schedule":     "0 0 * * *"                 // cron-style schedule. Only needed if mode=schedule
 *          "loglevel":     "info"                      // Adapters Log Level
 *      },
 *      "native": {                                     // the native object is available via adapter.config in your adapters code - use it for configuration
 *          "test1": true,
 *          "test2": 42
 *      }
 *  }
 *
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
"use strict";

// you have to require the utils module and call adapter function
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils

// you have to call the adapter function and pass a options object
// name has to be set and has to be equal to adapters folder name and main file name excluding extension
// adapter will be restarted automatically every time as the configuration changed, e.g system.adapter.template.0
var adapter = utils.adapter('mysensors');
var timer =     null;
var stopTimer = null;


var serialport = require('serialport'),			// include the serialport library
	SerialPort  = serialport.SerialPort,			// make a local instance of serial
	portName = "com5",// + adapter.config.interval,//"com17",								// get the port name from the command line
	portConfig = {
		baudRate: 115200,
		// call myPort.on('data') when a newline is received:
		parser: serialport.parsers.readline('\n')
	};
// open the serial port:
var myPort = new SerialPort(portName, portConfig);



	// this function runs if there's input from the serialport:
myPort.on('data', function(data) {
	//	socket.emit('message', data);		// send the data to the client
adapter.log.debug('mySens ' + data);
});

//принимаем и обрабатываем сообщения 
adapter.on('message', function (obj) {
    var wait = false;
    if (obj) {
        switch (obj.command) {

		case 'list_uart':												//ToDo отдать список портов
				serialport.list(function (err, ports) {		
					if (obj.callback) {adapter.log.info('obj.callback...ToDo выслать список СОМ портов');adapter.sendTo(obj.from, obj.command, ports, obj.callback);}			
					
					ports.forEach(function(port) {
					adapter.log.info(port.comName);
					adapter.log.info(port.pnpId);
					adapter.log.info(port.manufacturer);
					});
				});
			break;
				
		
		
		
		}
	}
});

var host  = ''; // название машины где подключен шлюз
var mysdevs = []; // список устройств mysensor

function pingAll() {
   adapter.log.debug('Ping-all' + adapter.config.comlst );
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
                configToAdd.push(adapter.config.devices[k].ip);
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
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
//adapter.on('message', function (obj) {
//    if (typeof obj == 'object' && obj.message) {
//        if (obj.command == 'send') {
            // e.g. send email or pushover or whatever
//            console.log('send command');

            // Send response in callback if required
 //           if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
 //       }
 //   }
//});





// is called when databases are connected and adapter received configuration.
// start here!
adapter.on('ready', function () {
    main();
});


function main() {
    host = adapter.host;

    for (var i = 0; i < adapter.config.devices.length; i++) {
        mysdevs.push(adapter.config.devices[i].name);
    }
    if (adapter.config.interval < 5000) {
        adapter.config.interval = 5000;
    
	}

    syncConfig();
//	myPort.write("2;1;1;1;2;0\n");	
//	myPort.write("2;1;1;1;2;1\n");	
    pingAll();
  //  timer = setInterval(pingAll, adapter.config.interval);
}
