const expect = require('chai').expect;
const setup  = require('./lib/setup');
const dgram  = require('dgram');
const fs     = require('fs');

let objects     = null;
let states      = null;
let connected   = false;
const port      = 15003;
let udpClient;
let lastMessage;
let someObject;

function checkConnection(value, done, counter) {
    counter = counter || 0;
    if (counter > 20) {
        done && done('Cannot check ' + value);
        return;
    }

    states.getState('mysensors.0.info.connection', (err, state) => {
        if (err) console.error(err);
        if (state && typeof state.val === 'string' && ((value && state.val) || (!value && !state.val))) {
            connected = state.val;
            done();
        } else {
            setTimeout(() => checkConnection(value, done, counter + 1), 500);
        }
    });
}

function checkValue(id, value, cb, counter) {
    counter = counter || 0;
    if (counter > 20) {
        return done && done('Cannot check ' + value);
    }

    states.getState(id, (err, state) => {
        if (err) console.error(err);
        if (state && value == state.val) {
            cb(err, state);
        } else {
            setTimeout(() => checkValue(id, value, cb, counter + 1), 500);
        }
    });
}

function sendMessage(message, callback) {
    udpClient.send(Buffer.from(message), 0, message.length, port, '127.0.0.1', (err, bytes) =>
        callback && callback(err));
}

function sendMessages(list, interval, callback) {
    if (!list || !list.length) {
        callback && callback();
    } else {
        sendMessage(list.pop(), err =>
            setTimeout(() =>
                sendMessages(list, interval, callback), interval || 100));
    }
}

describe('mySensors UDP: Test UDP server', function () {
    before('mySensors UDP: Start js-controller', function (_done) {
        this.timeout(600000); // because of first install from npm
        setup.adapterStarted = false;

        setup.setupController(() => {
            const config = await setup.getAdapterConfig();
            // enable adapter
            config.common.enabled   = true;
            config.common.loglevel  = 'debug';

            config.native.mode      = 'server';
            config.native.type      = 'udp';
            config.native.bind      = '0.0.0.0';
            config.native.connTimeout = 5000;
            config.native.port      = port;

            setup.startController(async (_objects, _states) => {
                objects = _objects;
                states  = _states;
                //await states.setStateAsync(`${config._id}.alive`, false, true);
                await objects.setObjectAsync(config._id, config);

                setTimeout(_done, 1000);
            });
        });

        udpClient = dgram.createSocket('udp4');
        udpClient.on('message', data => {
            console.log('Received ' + data);
            lastMessage = data.toString();
        });
    });

    it('mySensors UDP: Check if sensor connected to ioBroker', function (done) {
        this.timeout(4000);
        const commands = fs.readFileSync(__dirname + '/lib/commands.txt').toString().split(/[\r\n|\n|\r]/g);
        states.setState('mysensors.0.inclusionOn', true, () =>
            setTimeout(() =>
                sendMessages(commands, 10, () => {
                    if (!connected) {
                        checkConnection(true, () => {
                            expect(lastMessage).to.be.equal('0;0;3;0;19;force presentation');
                            done();
                        });
                    } else {
                        expect(lastMessage).to.be.equal('0;0;3;0;19;force presentation');
                        done();
                    }
                }), 1000));
    });

    it('mySensors UDP: check created objects', function (done) {
        this.timeout(10000);
        const expected = {
            "_id": "mysensors.0.127_0_0_1.0.59_DIMMER.V_PERCENTAGE",
            "common": {
                "type": "number",
                "read": true,
                "write": true,
                "min": 0,
                "max": 100,
                "unit": "%",
                "name": "Test7 PWM 5V.V_PERCENTAGE",
                "role": "level.dimmer",
                "def": 0
            },
            "native": {
                "ip": "127.0.0.1",
                "id": "0",
                "childId": "59",
                "subType": "S_DIMMER",
                "subTypeNum": 4,
                "varType": "V_PERCENTAGE",
                "varTypeNum": 3
            },
            "type": "state"
        };

        setTimeout(() => {
            objects.getObject(expected._id, (err, obj) => {
                if (!obj) {
                    setTimeout(() => {
                        objects.getObject(expected._id, (err, obj) => {
                            expect(err).to.be.not.ok;
                            expect(obj).to.be.ok;
                            delete obj.user;
                            delete obj.acl;
                            delete obj.from;
                            delete obj.ts;

                            expect(JSON.stringify(expected)).to.be.equal(JSON.stringify(obj));
                            someObject = obj;
                            done();
                        });
                    }, 1000);
                } else {
                    expect(err).to.be.not.ok;
                    expect(obj).to.be.ok;
                    delete obj.user;
                    delete obj.acl;
                    delete obj.from;
                    delete obj.ts;
                    expect(JSON.stringify(expected)).to.be.equal(JSON.stringify(obj));
                    someObject = obj;
                    done();
                }
            });
        }, 5000);
    });

    it('mySensors UDP: it must receive numeric data', function (done) {
        this.timeout(5000);
        lastMessage = '';
        const data = `${someObject.native.id};${someObject.native.childId};1;0;${someObject.native.varTypeNum};58.7`;

        udpClient.send(Buffer.from(data), 0, data.length, port, '127.0.0.1', (err, bytes) => {
            expect(err).to.be.not.ok;
            expect(bytes).to.be.equal(data.length);
            checkValue(someObject._id, 58.7, (err, state) => {
                expect(err).to.be.not.ok;
                expect(state).to.be.ok;
                expect(state.val).to.be.equal(58.7);
                expect(state.ack).to.be.equal(true);
                done();
            });
        });
    });

    it('mySensors UDP: it must control numeric', function (done) {
        this.timeout(5000);
        lastMessage = '';
        states.setState(someObject._id, 15.5, err => {
            setTimeout(() => {
                expect(lastMessage).to.be.equal(`${someObject.native.id};${someObject.native.childId};1;1;${someObject.native.varTypeNum};15.5`);
                done();
            }, 1000);
        });
    });

    it('mySensors UDP: it must receive boolean data', function (done) {
        this.timeout(5000);
        lastMessage = '';
        someObject = {
            "_id": "mysensors.0.127_0_0_1.0.33_BINARY.V_STATUS",
            "common": {
                "name": "RELAY D8.V_STATUS",
                "type": "boolean",
                "role": "state.relay",
                "def": false,
                "read": true,
                "write": true
            },
            "native": {
                "ip": "127.0.0.1",
                "id": "0",
                "childId": "33",
                "subType": "S_BINARY",
                "subTypeNum": 3,
                "varType": "V_STATUS",
                "varTypeNum": 2
            },
            "type": "state",
            "user": "system.user.admin"
        };
        const data = `${someObject.native.id};${someObject.native.childId};1;0;${someObject.native.varTypeNum};1`;

        udpClient.send(Buffer.from(data), 0, data.length, port, '127.0.0.1', (err, bytes) => {
            expect(err).to.be.not.ok;
            expect(bytes).to.be.equal(data.length);
            checkValue(someObject._id, true, (err, state) => {
                expect(err).to.be.not.ok;
                expect(state).to.be.ok;
                expect(state.val).to.be.equal(true);
                expect(state.ack).to.be.equal(true);
                done();
            });
        });
    });

    it('mySensors UDP: it must control boolean', function (done) {
        this.timeout(5000);
        lastMessage = '';
        states.setState(someObject._id, true, err => {
            setTimeout(() => {
                expect(lastMessage).to.be.equal(someObject.native.id + ';' + someObject.native.childId + ';1;1;' + someObject.native.varTypeNum +';1');
                done();
            }, 1000);
        });
    });

    it('mySensors UDP: it must receive battery data', function (done) {
        this.timeout(5000);
        lastMessage = '';
        someObject = {
            "_id": "mysensors.0.127_0_0_1.0.255_ARDUINO_NODE.I_BATTERY_LEVEL",
            "common": {
                "name": "ETHduino by JR.I_BATTERY_LEVEL",
                "type": "number",
                "role": "value",
                "min": 0,
                "max": 100,
                "unit": "%",
                "def": 100,
                "read": true,
                "write": false
            },
            "native": {
                "ip": "127.0.0.1",
                "id": "0",
                "childId": "255",
                "subType": "S_ARDUINO_NODE",
                "subTypeNum": 17,
                "varType": "I_BATTERY_LEVEL",
                "varTypeNum": 0
            },
            "type": "state",
            "user": "system.user.admin"
        };
        const data = someObject.native.id + ';255;3;0;0;50';

        udpClient.send(Buffer.from(data), 0, data.length, port, '127.0.0.1', (err, bytes) => {
            expect(err).to.be.not.ok;
            expect(bytes).to.be.equal(data.length);
            checkValue(someObject._id, 50, (err, state) => {
                expect(err).to.be.not.ok;
                expect(state).to.be.ok;
                expect(state.val).to.be.equal(50);
                expect(state.ack).to.be.equal(true);
                done();
            });
        });
    });

    it('mySensors UDP: check metrics', function (done) {
        this.timeout(5000);
        const expected = {
            "_id": "mysensors.0.127_0_0_1.0.42_TEMP.V_TEMP",
            "common": {
                "name": "dallas.V_TEMP",
                "type": "number",
                "role": "value.temperature",
                "min": 0,
                "unit": "°F",
                "def": 0,
                "read": true,
                "write": false
            },
            "native": {
                "ip": "127.0.0.1",
                "id": "0",
                "childId": "42",
                "subType": "S_TEMP",
                "subTypeNum": 6,
                "varType": "V_TEMP",
                "varTypeNum": 0
            },
            "type": "state"
        };

        setTimeout(() => {
            objects.getObject(expected._id, (err, obj) => {
                if (!obj) {
                    setTimeout(() =>
                        objects.getObject(expected._id, (err, obj) => {
                            expect(err).to.be.not.ok;
                            expect(obj).to.be.ok;
                            expect(obj.common.unit).to.be.equal('°F');

                            delete obj.user;
                            delete obj.acl;
                            delete obj.from;
                            delete obj.ts;

                            expect(JSON.stringify(expected)).to.be.equal(JSON.stringify(obj));
                            someObject = obj;
                            done();
                        }), 1000);
                } else {
                    expect(err).to.be.not.ok;
                    expect(obj).to.be.ok;
                    expect(obj.common.unit).to.be.equal('°F');

                    delete obj.user;
                    delete obj.acl;
                    delete obj.from;
                    delete obj.ts;

                    expect(JSON.stringify(expected)).to.be.equal(JSON.stringify(obj));
                    someObject = obj;
                    done();
                }
            });
        }, 1000);
    });

    it('mySensors UDP: check disconnection', function (done) {
        this.timeout(6000);

        setTimeout(() =>
            checkConnection(false, err => {
                expect(connected).to.be.equal('');
                done();
            }), 5000);
    });

    after('mySensors UDP: Stop js-controller', function (done) {
        this.timeout(5000);
        udpClient && udpClient.close();
        setup.stopController(() =>
            setTimeout(() => done(), 4000));
    });
});
