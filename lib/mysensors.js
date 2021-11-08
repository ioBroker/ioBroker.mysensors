const util =         require('util');
const EventEmitter = require('events').EventEmitter;

function MySensors(options, log, onCreated) {
    if (!(this instanceof MySensors)) {
        return new MySensors(options, log, onCreated);
    }
    this._interface = null;
    this._interfaceParser = null;
    this.serialConnected = false;
    const clients = {};
    let lastMessageTs;
    let serialport;
	const that = this;

	function openSerial() {
		// serial;
        try {
            serialport = serialport || require('serialport');//.SerialPort;
        } catch (e) {
            console.warn('Serial port is not available');
        }
        if (serialport) {
            const portConfig = {baudRate: parseInt(options.baudRate,10) || 115200, autoOpen: false};
            const SerialPort = serialport; //.SerialPort;

            if (options.comName) {
                try {
                    that._interface = new SerialPort(options.comName, portConfig/*, false*/);
                    that._interfaceParser = that._interface.pipe(new serialport.parsers.Readline());
					that._interface.on('error', error => log.error('Failed to use serial port: ' + error));
                    that._interface.open(error => {
                        if (error) {
                            log.error('Failed to open serial port: ' + error);
                        } else {
                            log.info('Serial port opened');
                            // forward data
                            that._interfaceParser.on('data', data => {
                                data = data.toString();

                                // Do not reset timeout too often
                                if (options.connTimeout && (!lastMessageTs || Date.now() - lastMessageTs > 1000)) {
                                    if (that.disconnectTimeout) clearTimeout(that.disconnectTimeout);
                                    that.disconnectTimeout = setTimeout(that.disconnected.bind(that), options.connTimeout);
                                }

                                lastMessageTs = Date.now();

                                if (!that.serialConnected) {
                                    log && log.info('Connected');
                                    that.serialConnected = true;
                                    that.emit('connectionChange', true);
                                }

                                if (data.split(';').length < 6) {
                                    log && log.warn('Wrong serial data: ' + data);
                                } else {
                                    log && log.debug('Serial data received: ' + data);
                                    that.emit('data', data);
                                }
                            });

                            that._interface.on('error', err => log && err && log.error('Serial error: ' + err));
                            onCreated && onCreated();
                        }
                    });
                } catch (e) {
                    log && log.error(`Cannot open serial port "${options.comName}": ${e}`);
                    that._interface = null;
                    that._interfaceParser = null;
                }
            } else {
                log && log.error('No serial port defined');
            }
        }
	}

	function openTcpClient() {
        const net = require('net');
        that._interface = new net.Socket();

        that._interface.connect(options.port || 2323, options.ip, () => {
            if (!that.serialConnected) {
                log && log.info('Connected');
                that.serialConnected = true;

                if (onCreated) {
                    onCreated();
                }

                setImmediate(() => that.emit('connectionChange', true));
            }
        });

        let buffer = '';
        that._interface.on('data', data => {
            buffer += data.toString();
            const cmds = buffer.split('\n');
            for (let c = 0; c < cmds.length; c++) {
                if (cmds[c].split(';').length < 6) {
                    if (c === cmds.length - 1) {
                        buffer = cmds[c];
                        break;
                    } else {
                        log && log.warn('Wrong TCP data received: ' + cmds[c].replace('\n', ''));
                    }
                } else {
                    log && log.debug('TCP data received from: ' + cmds[c].replace('\n', ''));
                    setImmediate(cmd => that.emit('data', cmd), cmds[c]);
                }
            }
        });

        that._interface.on('close', () => {
            // request closed unexpectedly
            log && log.warn('Connection closed unexpectedly');
            that.disconnected();
            try {
                that._interface.close();
            } catch (e) {

            }
            setTimeout(openTcpClient, options.connTimeout);
        });

        that._interface.on('error', err => {
            log && err && log.error('Error: ' + err);
            that.disconnected();
        });
    }

    if (options.type === 'udp') {
        const dgram = require('dgram');
        this._interface = dgram.createSocket('udp4');

        this._interface.on('error', err => log && log.error('UDP server error: ' + err));

        this._interface.on('message', (data, rinfo) => {
            data = data.toString();

            // this must be per connection
            if (!clients[rinfo.address] || !clients[rinfo.address].connected) {
                log && log.info('Connected ' + rinfo.address + ':' + rinfo.port);
                clients[rinfo.address] = clients[rinfo.address] || {};
                clients[rinfo.address].connected = true;
                clients[rinfo.address].port      = rinfo.port;

                const addresses = [];
                for (const addr in clients) {
                    clients[addr].connected && addresses.push(addr);
                }

                this.emit('connectionChange', addresses.join(', '), rinfo.address, rinfo.port);
            }

            // Do not reset timeout too often
            if (options.connTimeout && (!clients[rinfo.address] || !clients[rinfo.address].lastMessageTs || Date.now() - clients[rinfo.address].lastMessageTs > 1000)) {
                if (clients[rinfo.address].disconnectTimeout) {
                    clearTimeout(clients[rinfo.address].disconnectTimeout);
                }

                clients[rinfo.address].disconnectTimeout = setTimeout((addr, port) =>
                    this.disconnected(addr, port), options.connTimeout, rinfo.address, rinfo.port);
            }

            clients[rinfo.address].lastMessageTs = Date.now();

            if (data.split(';').length < 6) {
                log && log.warn(`Wrong UDP data received from ${rinfo.address}:${rinfo.port}: ${data}`);
            } else {
                log && log.debug(`UDP data received from ${rinfo.address}:${rinfo.port}: ${data}`);
                this.emit('data', data, rinfo.address, rinfo.port);
            }
        });

        this._interface.on('listening', () => {
            log && log.info('UDP server listening on port ' + options.port || 5003);
            onCreated && onCreated();
        });

        if (options.mode === 'server') {
            this._interface.bind(options.port || 5003, options.bind || undefined);
        }
    } else
    if (options.type === 'tcp') {

        const net = require('net');

        this._interface = net.createServer(socket => {
            const ip   = socket.remoteAddress;
            const port = socket.remotePort;

            // this must be per connection
            if (!clients[ip] || !clients[ip].connected) {
                log && log.info(`Connected ${ip}:${socket.remotePort}`);
                clients[ip] = clients[ip] || {};
                clients[ip].connected = true;
                clients[ip].port      = socket.remotePort;
                clients[ip].socket    = socket;

                const addresses = [];
                for (const addr in clients) {
                    clients[addr].connected && addresses.push(addr);
                }

                this.emit('connectionChange', addresses.join(', '), ip, port);
            }
            let buffer = '';

            socket.on('data', data => {
                data = data.toString();

                buffer += data;
                if (data.split(';').length < 6) {
                    log && log.warn(`Wrong TCP data received from ${ip}:${port}: ${data.replace('\n', '')}`);
                } else {
                    log && log.debug(`TCP data received from ${ip}:${port}: ${data.replace('\n', '')}`);
                    setImmediate(() => this.emit('data', data, ip, port));
                }
            });

            socket.on('error', err => {
                log && err && log.error(`Error for "${ip}": ${err}`);
                if (clients[ip]) {
                    clients[ip].socket = null;
                }
                this.disconnected(ip, port);
                socket.destroy();
            });

            socket.on('close', () => {
                // request closed unexpectedly
                if (clients[ip] && clients[ip].socket) {
                    clients[ip].socket = null;
                    log && log.warn(`Connection "${ip}" closed unexpectedly`);
                    this.disconnected(ip, port);
                    socket.destroy();
                }
            });

            socket.on('end', () => buffer = '');
        });

        this._interface.on('error', err => log && log.error('TCP server error: ' + err));

        this._interface.listen(options.port || 5003, options.bind || undefined, err => {
            log && err && log.error('TCP server error: ' + err);
            err && process.exit(1);
            log && log.info(`TCP server listening on port ${options.port}` || 5003);
            onCreated && onCreated();
        });
    } else
    if (options.type === 'tcpclient') {
        openTcpClient();
    } else {
        openSerial();
    }

    this.write = function (data, ip) {
        if (this._interface) {
            log && log.debug('Send raw data: ' + data);

            if (options.type === 'udp') {
                if (clients[ip] && clients[ip].connected && clients[ip].port) {
                    this._interface.send(Buffer.from(data), 0, data.length, clients[ip].port, ip, err => {
                        if (log) {
                            if (err) {
                                log.error(`Cannot send to ${ip}[${data}]: ${err}`);
                            } else {
                                log.debug(`Sent to ${ip} ${data}`);
                            }
                        }
                    });
                } else if (!ip) {
                    for (const i in clients) {
                        this._interface.send(Buffer.from(data), 0, data.length, clients[i].port, i, err => {
                            if (log) {
                                if (err) {
                                    log.error(`Cannot send to ${ip}[${data}]: ${err}`);
                                } else {
                                    log.debug(`Sent to ${ip} ${data}`);
                                }
                            }
                        });
                    }
                } else if (log) {
                    log.error('Cannot send to ' + ip + ' because not connected');
                }
            } else if (options.type === 'tcp') {
                if (clients[ip] && clients[ip].connected && clients[ip].socket) {
                    clients[ip].socket.write(data + '\n', err => {
                        if (log) {
                            if (err) {
                                log.error(`Cannot send to ${ip}[${data}]: ${err}`);
                            } else {
                                log.debug(`Sent to ${ip} ${data}`);
                            }
                        }
                    });
                } else if (!ip) {
                    for (const _ip in clients) {
                        if (!clients.hasOwnProperty(_ip)) {
                            continue;
                        }

                        clients[_ip].socket.write(data + '\n', err => {
                            if (log) {
                                if (err) {
                                    log.error(`Cannot send [${data}]: ${err}`);
                                } else {
                                    log.debug('Sent ' + data);
                                }
                            }
                        });
                    }
                } else if (log) {
                    log.error(`Cannot send to ${ip} because not connected`);
                }
            } else if (options.type === 'tcpclient') {
                this._interface.write(data + '\n', error => {
                    if (log && error) {
                        log.error('Cannot send: ' + error);
                        if (this.serialConnected) {
                            this._interface.close();
                        }
                        that._interface = null;
                        that.disconnected();
                        log.error('Cannot send_: ' + error);
                        setTimeout(() => openTcpClient(), options.connTimeout);
                    }
                });
            } else {
                //serial
				try {
					this._interface.write(data + '\n', error => {
						if (log && error) {
							log.error('Cannot send: ' + error);
                            if (this._interface && this._interface.isOpen) {
                                this._interface.pause();
                                this._interface.close();
                            }
                            that._interface = null;
                            that._interfaceParser = null;
                            that.disconnected();
							log.error('Cannot send_: ' + error);
							setTimeout(() => openSerial(), 500);
						}
					});
				} catch (error) {
                    if (this._interface && this._interface.isOpen) {
                        this._interface.pause();
                        this._interface.close();
                    }
					this._interface = null;
                    that._interfaceParser = null;
					this.disconnected();
					log.error('Cannot send_: ' + error);
					setTimeout(openSerial, 500);
				}
            }
        } else {
            log && log.warn('Wrong serial data: ' + data);
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
                const addresses = [];
                for (const _addr in clients) {
                    if (!clients.hasOwnProperty(_addr)) {
                        continue;
                    }
                    if (clients[_addr].connected) {
                        addresses.push(_addr);
                    }
                }
                this.emit('connectionChange', addresses.join(', '), addr, clients[addr].port);
                // stop timer
                if (clients[addr].disconnectTimeout) {
                    clearTimeout(clients[addr].disconnectTimeout);
                }
                clients[addr].disconnectTimeout = null;
            }
        } else
        if (this.serialConnected) {
            log && log.info('disconnected ' + (addr || ''));
            this.serialConnected = false;
            this.emit('connectionChange', false);
            // stop timer
            if (this.disconnectTimeout) {
                clearTimeout(this.disconnectTimeout);
            }
            this.disconnectTimeout = null;
        }
    };

    this.destroy = function () {
        try {
            if (this._interface) {
                if (options.type === 'udp') {
                    this._interface.close();
                } else if (options.type === 'tcp') {
                    this._interface.close();
                } else if (options.type === 'tcpclient') {
                    this._interface.close();
                } else {
                    //serial
                    this._interface.close();
                }
            }
        } catch (e) {

        }
    };

    return this;
}

// extend the EventEmitter class using our Radio class
util.inherits(MySensors, EventEmitter);

module.exports = MySensors;
