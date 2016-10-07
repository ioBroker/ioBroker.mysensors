var net    = require('net');
var tcpClient = new net.Socket();
var port   = 15003;

tcpClient.on('error', function (err) {
    console.error(err);
});

tcpClient.connect({port: port}, function(err) {
    console.log('Connected ' + (err || ''));
});

tcpClient.on('data', function (data) {
    console.log('Received ' + data);
});

function sendMessage(message, callback) {
    tcpClient.write(message, function(err, bytes) {
        callback && callback(err);
    });
}

function sendMessages(list, interval, callback) {
    if (!list || !list.length) {
        callback && callback();
    } else {
        var msg = list.pop();
        if (msg.indexOf('---') !== -1) {
            callback && callback();
            return;
        }
        // skip message
        if (msg[0] === '#') {
            setTimeout(function() {
                sendMessages(list, interval, callback);
            }, interval || 100);
            return;
        }
        console.log('Send ' + msg);
        sendMessage(msg + '\n', function (err) {
            setTimeout(function() {
                sendMessages(list, interval, callback);
            }, interval || 100);
        });
    }
}

var commands = require('fs').readFileSync(__dirname + '/commands.txt').toString().split(/[\r\n|\n|\r]/g);

setTimeout(function () {
    sendMessages(commands, 10, function () {

    });
}, 500);

setTimeout(function () {
    if (tcpClient) tcpClient.destroy();
    process.exit();
}, 10000);