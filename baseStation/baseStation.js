var xbee_api = require('xbee-api'),
    serialPort = require('serialport'),
    MongoClient = require('mongodb').MongoClient,
    mqtt = require('mqtt');

var xbeeAPIOptions = {
    api_mode: 2
};

var serialOptions = {
    baudrate: 9600,
    openImmediately: true
};

var mongoURL = 'mongodb://localhost:27017/ZigBeeBaseStation';
var mqttURL = 'mqtt://broker.mqtt-dashboard.com';
var mqttTopicPrefix = 'EC544-Group2-Challenge1/temperature/';


serialPort.list(function(err, ports) {
    if (err) console.log('Failed to read list of serial ports');
    else {
        var filteredPortList = ports.filter(portnameFilter);

        var xbeeAPI = new xbee_api.XBeeAPI(xbeeAPIOptions);
        serialOptions.parser = xbeeAPI.rawParser();

        var Serial = new serialPort.SerialPort(getPortName(filteredPortList, 0), serialOptions, serialOptions.openImmediately, function() {
            console.log('Opened serial port');
            var C = xbee_api.constants;
            var databaseConnected = false;
            var mqttConnected = false;
            var database = null;

            console.log('Connecting to database server');
            MongoClient.connect(mongoURL, function(err, db) {
                if (err) console.log('Failed to connect to database server. Proceeding without database ....');
                else {
                    console.log('Connected to database server');
                    databaseConnected = true;
                    database = db;
                }
            });

            var mqttClient = mqtt.connect(mqttURL);
            console.log('Connecting to MQTT server');
            mqttClient.on('connect', function() {
                console.log('Connected to MQTT server');
                mqttConnected = true;
            });

            xbeeAPI.on('frame_object', function(frame) {
                data = buildDocument(frame);
                if (databaseConnected) insertDocument(data, database, 'temperature');
                if (mqttConnected) publishMQTT(data, mqttClient, mqttTopicPrefix + data.deviceID);
                if (!databaseConnected && !mqttConnected) console.log('<<', frame);
            });
        });
    }
});

function portnameFilter(port) {
    if (port.comName.match('/dev/cu.u')) {
        return true;
    } else return false;
};

function getPortName(portList, index) {
    return portList[index].comName.replace('cu', 'tty');
}

function buildDocument(APIframe) {
    return {
        deviceID: APIframe.remote64,
        time: Date.now(),
        value: parseFloat(APIframe.data.toString('ascii'))
    };
}

function insertDocument(doc, db, collect) {
    db.collection(collect).insertOne(doc, function(err, result) {
        if (err) console.log('Error in inserting document')
        else console.log('Inserted 1 documents in collection');
    });
}

function publishMQTT(doc, mqttClient, topic) {
    mqttClient.publish(topic, JSON.stringify(doc), function() {
        console.log('Published MQTT message to topic: ' + topic);
    });
}
