var util =              require('util');
var EventEmitter =      require('events').EventEmitter;

function MySensors(options, log) {
    if (!(this instanceof MySensors)) return new MySensors(adapter, states);
    this._interface = null;
    this.connected = false;
    var clients = {};
    var lastMessageTs;

    if (options.type === 'udp') {
        var dgram = require('dgram');
        this._interface = dgram.createSocket('udp4');

        this._interface.on('error', function (err) {
            if (log) log.error('UDP server error: ' + err);
        });

        this._interface.on('message', function (data, rinfo) {
            data = data.toString();

            // this must be per connection
            if (!clients[rinfo.address] || !clients[rinfo.address].connected) {
                if (log) log.info('Connected ' + rinfo.address + ':' + rinfo.port);
                clients[rinfo.address] = clients[rinfo.address] || {};
                clients[rinfo.address].connected = true;
                clients[rinfo.address].port      = rinfo.port;

                var addresses = [];
                for (var addr in clients) {
                    if (clients[addr].connected) addresses.push(addr);
                }

                this.emit('connectionChange', addresses.join(', '), rinfo.address, rinfo.port);
            }

            // Do not reset timeout too often
            if (options.connTimeout && (!clients[rinfo.address] || !clients[rinfo.address].lastMessageTs || new Date().getTime() - clients[rinfo.address].lastMessageTs > 1000)) {
                if (clients[rinfo.address].disconnectTimeout) clearTimeout(clients[rinfo.address].disconnectTimeout);
                clients[rinfo.address].disconnectTimeout = setTimeout(function (addr, port) {
                    this.disconnected(addr, port);
                }.bind(this), options.connTimeout, rinfo.address, rinfo.port);
            }

            clients[rinfo.address].lastMessageTs = new Date().getTime();

            if (data.split(';').length < 6) {
                if (log) log.warn('Wrong UDP data received from ' + rinfo.address + ':' + rinfo.port + ': ' + data);
            } else {
                if (log) log.debug('UDP data received from ' + rinfo.address + ':' + rinfo.port + ': ' + data);
                this.emit('data', data, rinfo.address, rinfo.port);
            }
        }.bind(this));

        this._interface.on('listening', function () {
            if (log) log.info('UDP server listening on port ' + options.port || 5003);
        }.bind(this));

        if (options.mode === 'server') {
            this._interface.bind(options.port || 5003, options.bind || undefined);
        }
    } else
    if (options.type === 'tcp') {

        var net = require('net');

        this._interface = net.createServer(function(socket) {
            var ip   = socket.remoteAddress;
            var port = socket.remotePort;
            // this must be per connection
            if (!clients[ip] || !clients[ip].connected) {
                if (log) log.info('Connected ' + ip + ':' + socket.remotePort);
                clients[ip] = clients[ip] || {};
                clients[ip].connected = true;
                clients[ip].port      = socket.remotePort;
                clients[ip].socket    = socket;

                var addresses = [];
                for (var addr in clients) {
                    if (clients[addr].connected) addresses.push(addr);
                }

                this.emit('connectionChange', addresses.join(', '), ip, port);
            }

            socket.on('data', function (data) {
                data = data.toString();
                if (data.split(';').length < 6) {
                    if (log) log.warn('Wrong TCP data received from ' + ip + ':' + port + ': ' + data);
                } else {
                    if (log) log.debug('TCP data received from ' + ip + ':' + port + ': ' + data);
                    setTimeout(function () {
                        this.emit('data', data, ip, port);
                    }.bind(this), 0);
                }
            }.bind(this));

            socket.on('error', function (err) {
                if (log && err) log.error('Error for "' + ip + '": ' + err);
                if (clients[ip]) clients[ip].socket = null;
                this.disconnected(ip, port);
                socket.destroy();
            }.bind(this));

            socket.on('close', function() {
                // request closed unexpectedly
                if (clients[ip] && clients[ip].socket) {
                    clients[ip].socket = null;
                    if (log) log.warn('Connection "' + ip + '" closed unexpectedly');
                    this.disconnected(ip, port);
                    socket.destroy();
                }
            }.bind(this));

            socket.on('end', function() {
                if (log ) log.warn('Connection "' + ip + '" closed');
                if (clients[ip]) clients[ip].socket = null;
                this.disconnected(ip, port);
                socket.destroy();
            }.bind(this));

        }.bind(this));

        this._interface.on('error', function (err) {
            if (log) log.error('TCP server error: ' + err);
        });

        this._interface.listen(options.port || 5003, options.bind || undefined, function (err) {
            if (log && err) log.error('TCP server error: ' + err);
            if (err) process.exit(1);
            if (log) log.info('TCP server listening on port ' + options.port || 5003);
        });

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
                    data = data.toString();

                    // Do not reset timeout too often
                    if (options.connTimeout && (!lastMessageTs || new Date().getTime() - lastMessageTs > 1000)) {
                        if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
                        this.disconnectTimeout = setTimeout(this.disconnected.bind(this), options.connTimeout);
                    }

                    lastMessageTs = new Date().getTime();

                    if (!this.connected) {
                        if (log) log.info('Connected');
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

    this.write = function (data, ip) {
        if (this._interface) {
            if (log) log.debug('Send raw data: ' + data);

            if (options.type === 'udp') {
                if (clients[ip] && clients[ip].connected && clients[ip].port) {
                    this._interface.send(new Buffer(data), 0, data.length, clients[ip].port, ip, function(err) {
                        if (log) {
                            if (err) {
                                log.error('Cannot send to ' + ip + '[' + data + ']: ' + err);
                            } else {
                                log.debug('Sent to ' + ip + ' ' + data);
                            }
                        }
                    });
                } else if (!ip) {
                    for (var i in clients) {
                        this._interface.send(new Buffer(data), 0, data.length, clients[i].port, i, function(err) {
                            if (log) {
                                if (err) {
                                    log.error('Cannot send to ' + ip + '[' + data + ']: ' + err);
                                } else {
                                    log.debug('Sent to ' + ip + ' ' + data);
                                }
                            }
                        });
                    }
                } else if (log) {
                    log.error('Cannot send to ' + ip + ' because not connected');
                }
            } else if (options.type === 'tcp') {
                if (clients[ip] && clients[ip].connected && clients[ip].socket) {
                    clients[ip].socket.write(data + '\n', function(err) {
                        if (log) {
                            if (err) {
                                log.error('Cannot send to ' + ip + '[' + data + ']: ' + err);
                            } else {
                                log.debug('Sent to ' + ip + ' ' + data);
                            }
                        }
                    });
                } else if (!ip) {
                    for (var i in clients) {
                        clients[ip].socket.write(data + '\n', function(err) {
                            if (log) {
                                if (err) {
                                    log.error('Cannot send to ' + ip + '[' + data + ']: ' + err);
                                } else {
                                    log.debug('Sent to ' + ip + ' ' + data);
                                }
                            }
                        });
                    }
                } else if (log) {
                    log.error('Cannot send to ' + ip + ' because not connected');
                }
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

    this.disconnected = function (addr) {
        if (addr) {
            if (clients[addr] && clients[addr].connected) {
                clients[addr].connected = false;
                var addresses = [];
                for (var addr in clients) {
                    if (clients[addr].connected) addresses.push(addr);
                }
                this.emit('connectionChange', addresses.join(', '), addr, clients[addr].port);
                // stop timer
                if (clients[addr].disconnectTimeout) clearTimeout(clients[addr].disconnectTimeout);
                clients[addr].disconnectTimeout = null;
            }
        } else
        if (this.connected) {
            if (log) log.info('disconnected ' + (addr || ''));
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