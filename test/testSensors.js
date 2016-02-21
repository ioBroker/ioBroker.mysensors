var expect = require('chai').expect;
var setup  = require(__dirname + '/lib/setup');
var dgram  = require('dgram');
var fs     = require('fs');
var objects     = null;
var states      = null;
var connected   = false;
var udpClient;

function checkConnection(value, done, counter) {
    counter = counter || 0;
    if (counter > 20) {
        done && done('Cannot check ' + value);
        return;
    }

    states.getState('mysensors.0.info.connection', function (err, state) {
        if (err) console.error(err);
        if (state && typeof state.val == 'string' && ((value && state.val.indexOf(',') != -1) || (!value && state.val.indexOf(',') === -1))) {
            connected = value;
            done();
        } else {
            setTimeout(function () {
                checkConnection(value, done, counter + 1);
            }, 1000);
        }
    });
}

function sendMessage(message, callback) {
    udpClient.send(new Buffer(message), 0, message.length, 5003, '127.0.0.1', function(err, bytes) {
        callback && callback(err);
    });
}
function sendMessages(list, interval, callback) {
    if (!list || !list.length) {
        callback && callback();
    } else {
        sendMessage(list.pop(), function (err) {
            setTimeout(function() {
                sendMessages(list, interval, callback);
            }, interval || 100);
        });
    }
}

describe('mySensors: Test UDP server', function() {
    before('mySensors: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm

        setup.setupController(function () {
            var config = setup.getAdapterConfig();
            // enable adapter
            config.common.enabled   = true;
            config.common.loglevel  = 'debug';

            config.native.mode      = 'server';
            config.native.type      = 'udp';
            config.native.bind      = '0.0.0.0';
            config.native.connTimeout   = 60000;
            config.native.port      = 5003;

            setup.setAdapterConfig(config.common, config.native);

            setup.startController(function (_objects, _states) {
                objects = _objects;
                states  = _states;
                _done();
            });
        });

        udpClient = dgram.createSocket('udp4');
    });

    it('mySensors: Check if connected to MQTT broker', function (done) {
        this.timeout(20000);
        var commands = fs.readFileSync(__dirname + '/lib/commands.txt').toString().split(/[\r\n|\n|\r]/g);
        sendMessages(commands, 50, function () {
            if (!connected) {
                checkConnection(true, done);
            } else {
                done();
            }
        });
    });
    
    after('mySensors: Stop js-controller', function (done) {
        this.timeout(5000);
        if (udpClient) udpClient.close();
        setup.stopController(function () {
            done();
        });
    });
});