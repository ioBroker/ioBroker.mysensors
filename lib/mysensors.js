var util =              require('util');
var EventEmitter =      require('events').EventEmitter;

function MySensors(options, log, onCreated) {
    if (!(this instanceof MySensors)) return new MySensors(options, log, onCreated);
    this._interface = null;
    this.serialConnected = false;
    var clients = {};
    var lastMessageTs;
    var serialport;
	var that = this;

	function openSerial() {
		// serial;
        try {
            serialport = serialport || require('serialport');//.SerialPort;
        } catch (e) {
            console.warn('Serial port is not available');
        }
        if (serialport) {
            var portConfig = {baudRate: parseInt(options.baudRate,10) || 115200, autoOpen: false, parser: serialport.parsers.readline('\n')};
            var SerialPort = serialport//.SerialPort;

            if (options.comName) {
                try {
                    that._interface = new SerialPort(options.comName, portConfig/*, false*/);
					that._interface.on('error', function (error) {
					    log.error('Failed to use serial port: ' + error);
					});
                    that._interface.open(function (error) {
                        if (error) {
                            log.error('Failed to open serial port: ' + error);
                        } else {
                            log.info('Serial port opened');
                            // forward data
                            that._interface.on('data', function (data) {
                                data = data.toString();

                                // Do not reset timeout too often
                                if (options.connTimeout && (!lastMessageTs || new Date().getTime() - lastMessageTs > 1000)) {
                                    if (that.disconnectTimeout) clearTimeout(that.disconnectTimeout);
                                    that.disconnectTimeout = setTimeout(that.disconnected.bind(that), options.connTimeout);
                                }

                                lastMessageTs = new Date().getTime();

                                if (!that.serialConnected) {
                                    if (log) log.info('Connected');
                                    that.serialConnected = true;
                                    that.emit('connectionChange', true);
                                }

                                if (data.split(';').length < 6) {
                                    if (log) log.warn('Wrong serial data: ' + data);
                                } else {
                                    if (log) log.debug('Serial data received: ' + data);
                                    that.emit('data', data);
                                }
                            }.bind(that));

                            that._interface.on('error', function (err) {
                                if (log && err) log.error('Serial error: ' + err);
                            });
                            if (onCreated) onCreated();
                        }
                    }.bind(that));
                } catch (e) {
                    if (log) log.error('Cannot open serial port "' + options.comName + '": ' + e);
                    that._interface = null;
                }
            } else {
                if (log) log.error('No serial port defined');
            }
        }
	}
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
            if (onCreated) onCreated();
        }.bind(this));

        if (options.mode === 'server') {
            this._interface.bind(options.port || 5003, options.bind || undefined);
        } else {

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
            var buffer = '';

            socket.on('data', function (data) {
                data = data.toString();

                buffer += data;
                if (data.split(';').length < 6) {
                    if (log) log.warn('Wrong TCP data received from ' + ip + ':' + port + ': ' + data.replace('\n', ''));
                } else {
                    if (log) log.debug('TCP data received from ' + ip + ':' + port + ': ' + data.replace('\n', ''));
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
                buffer = '';
            }.bind(this));

        }.bind(this));

        this._interface.on('error', function (err) {
            if (log) log.error('TCP server error: ' + err);
        });

        this._interface.listen(options.port || 5003, options.bind || undefined, function (err) {
            if (log && err) log.error('TCP server error: ' + err);
            if (err) process.exit(1);
            if (log) log.info('TCP server listening on port ' + options.port || 5003);
            if (onCreated) onCreated();
        });
    } else {
        openSerial();
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
                    for (var _ip in clients) {
                        if (!clients.hasOwnProperty(_ip)) continue;

                        clients[_ip].socket.write(data + '\n', function (err) {
                            if (log) {
                                if (err) {
                                    log.error('Cannot send [' + data + ']: ' + err);
                                } else {
                                    log.debug('Sent ' + data);
                                }
                            }
                        });
                    }
                } else if (log) {
                    log.error('Cannot send to ' + ip + ' because not connected');
                }
            } else {
                //serial
				try {
					this._interface.write(data + '\n', function (error) {
						if (log && error) {
							log.error('Cannot send: ' + error);
                            if (this._interface.isOpen()) {
                                this._interface.pause();
                                this._interface.close();
                            }
                            that._interface = null;
                            that.disconnected();
							log.error('Cannot send_: ' + error);
							setTimeout(function () {
								openSerial();
							}, 500);
						}
					});
				} catch (error) {
                    if (this._interface.isOpen()) {
                        this._interface.pause();
                        this._interface.close();
                    }
					this._interface = null;
					this.disconnected();
					log.error('Cannot send_: ' + error);
					setTimeout(function () {
						openSerial();
					}, 500);
				}
            }
        } else {
            if (log) log.warn('Wrong serial data: ' + data);
        }
    };

    this.isConnected = function (addr) {
        if (addr) {
            return clients[addr] && clients[addr].connected;
        } else {
            return this.serialConnected;
        }
    };

    this.disconnected = function (addr) {
        if (addr) {
            if (clients[addr] && clients[addr].connected) {
                clients[addr].connected = false;
                var addresses = [];
                for (var _addr in clients) {
                    if (!clients.hasOwnProperty(_addr)) continue;
                    if (clients[_addr].connected) addresses.push(_addr);
                }
                this.emit('connectionChange', addresses.join(', '), addr, clients[addr].port);
                // stop timer
                if (clients[addr].disconnectTimeout) clearTimeout(clients[addr].disconnectTimeout);
                clients[addr].disconnectTimeout = null;
            }
        } else
        if (this.serialConnected) {
            if (log) log.info('disconnected ' + (addr || ''));
            this.serialConnected = false;
            this.emit('connectionChange', false);
            // stop timer
            if (this.disconnectTimeout) clearTimeout(this.disconnectTimeout);
            this.disconnectTimeout = null;
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
