var util =              require('util');
var EventEmitter =      require('events').EventEmitter;

function MySensors(options, log) {
    if (!(this instanceof MySensors)) return new MySensors(adapter, states);
    this._interface = null;
    this.connected = false;
    var lastMessageTs;

    if (options.type === 'udp') {
        var dgram = require('dgram');
        this._interface = dgram.createSocket('udp4');

        this._interface.on('error', function (err) {
            if (log) log.error('UDP server error: ' + err);
        });

        this._interface.on('message', function (msg, rinfo) {
            if (data.split(';').length < 6) {
                if (log) log.warn('Wrong UDP data received from ' + rinfo.address + ':' + rinfo.port + ': ' + msg);
            } else {
                if (log) log.debug('UDP data received from ' + rinfo.address + ':' + rinfo.port + ': ' + msg);
                this.emit('data', rinfo.address.replace(/\./g, '_') + msg);
            }
        });

        this._interface.on('listening', function () {
            if (log) log.info('UDP server listening on port ' + options.port || 5003);
        }.bind(this));

        if (options.mode === 'server') {
            this._interface.bind(options.port || 5003, options.bind || undefined);
        }
    } else if (options.type === 'tcp') {

    } else {
        // serial
        var serialport = require('serialport');//.SerialPort;
        var portConfig = {baudRate: 115200, parser: serialport.parsers.readline('\n')};
        var SerialPort = serialport.SerialPort;

        if (options.comName) {
            try {
                this._interface = new SerialPort(options.comName, portConfig);
            } catch (e) {
                if (log) log.error('Cannot open serial port "' + options.comName + '": ' + e);
                this._interface = null;
            }

            // forward data
            if (this._interface) {
                this._interface.on('data', function (data) {

                    // Do not reset timeout too often
                    if (options.connTimeout && (!lastMessageTs || new Date().getTime() - lastMessageTs > 1000)) {
                        if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
                        this.disconnectTimeout = setTimeout(this.disconnected.bind(this), options.connTimeout);
                    }

                    lastMessageTs = new Date().getTime();

                    if (!this.connected) {
                        this.connected = true;
                        this.emit('connectionChange', true);
                    }

                    if (data.split(';').length < 6) {
                        if (log) log.warn('Wrong serial data: ' + data);
                    } else {
                        if (log) log.warn('Serial data received: ' + data);
                        this.emit('data', data);
                    }
                }.bind(this));

                this._interface.on('error', function (err) {
                    if (log) log.error('Serial error: ' + err);
                });
            }
        } else {
            if (log) log.error('No serial port defined');
        }
    }

    this.write = function (data) {
        if (this._interface) {
            if (log) log.debug('Send raw data: ' + data);

            if (options.type === 'udp') {

            } else if (options.type === 'tcp') {

            } else {
                //serial
                this._interface.write(data + '\n');
            }
        } else {
            if (log) log.warn('Wrong serial data: ' + data);
        }
    };

    this.isConnected = function () {
        return this.connected;
    };

    this.disconnected = function () {
        if (this.connected) {
            this.connected = false;
            this.emit('connectionChange', false);
            // stop timer
            if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
            this.disconnectTimeout = null;
        }
    };

    this.connected = function () {
        if (!this.connected) {
            this.connected = true;
            this.emit('connectionChange', true);
        }
    };

    this.destroy = function () {
        if (this._interface) {
            if (options.type === 'udp') {
                this._interface.close();
            } else if (options.type === 'tcp') {
                this._interface.close();
            } else {
                //serial
                this._interface.close();
            }
        }
    };

    return this;
}

// extend the EventEmitter class using our Radio class
util.inherits(MySensors, EventEmitter);


module.exports = MySensors;