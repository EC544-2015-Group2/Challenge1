var xbee_api = require('xbee-api'),
    serialPort = require('serialport'),
    MongoClient = require('mongodb').MongoClient,
    assert = require('assert');

var mongoURL = 'mongodb://localhost:27017/ZigBeeBaseStation';


serialPort.list(function(err, ports) {
    assert.equal(null, err);
    var portName = ports.filter(function(port) {
        if (port.comName.match('/dev/cu.u')) {
            return true;
        } else return false;
    })[0].comName.replace('cu', 'tty');

    var xbeeAPI = new xbee_api.XBeeAPI({
        api_mode: 2
    });

    var Serial = new serialPort.SerialPort(portName, {
        baudrate: 9600,
        parser: xbeeAPI.rawParser()
    }, true, function() {
        console.log('Opened serial port');
        var C = xbee_api.constants;
        var nodes = {};

        MongoClient.connect(mongoURL, function(err, db) {
            console.log('Connected to database server')
            xbeeAPI.on('frame_object', function(frame) {
                db.collection('temperature').insertOne({
                    deviceID: frame.remote64,
                    time: Date.now(),
                    value: parseFloat(frame.data.toString('ascii'))
                }, function(err, result) {
                    assert.equal(null, err);
                    console.log('Inserted a document into temperature collection');
                });
            });
        });
    });
});