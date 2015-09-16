/*
* This is part of the challenge 1 in EC544 at Boston University in Fall 2015 done by group 2
* consisting of the following members
* 1) Gaurav Hirlekar
* 2) Reeve Hicks
* 3) Xin Peng
* 4) Ye Liu
* 5) Hao Wu
*
*
* This is the NodeJS program running on a base station to which is connected the Xbee
* coordinator through an Xbee explorer dongle. This program talks to it through the 'serialport'
* library, using the 'xbee-api' library to handle the input/output buffer, validate incoming API frames,
* call events, and parse the API frames.
*
* Optionally, if a mongoDB server is accepting connections at the supplied URL, insert objects/documents
* into a 'temperature' collection. Also, if a MQTT server is accepting connections at the supplied URL,
* publish stringified JSON at the supplied topic URL. If neither database nor mqtt are available,
* just log the object to console.
*
*                                        mongodb
*                                           |
*                                           ~
*                                           |
* XBEE ----serialport-----xbee-api----------|------ console.log
*                                           |
*                                           ~
*                                           |
*                                          mqtt

* IMPORTANT: All XBees should be configured in API mode 2 (escaped mode) as the xbee-arduino library
* requires this mode
*
*
*
*
* MIT LICENSE
* Permission is hereby granted, free of charge, to any person obtaining a copy of this software
* and associated documentation files (the “Software”), to deal in the Software without restriction,
* including without limitation the rights to use, copy, modify, merge, publish, distribute,
* sublicense, and/or sell copies of the Software, and to permit persons to whom the Software
* is furnished to do so, subject to the following conditions:
* The above copyright notice and this permission notice shall be included in all copies or
* substantial portions of the Software.
*/

// Loads required NPM modules and makes them available in scope
var xbee_api = require('xbee-api'),
    serialPort = require('serialport'),
    MongoClient = require('mongodb').MongoClient,
    mqtt = require('mqtt');

var mongoURL = 'mongodb://localhost:27017/ZigBeeBaseStation',
    mqttURL = 'mqtt://broker.mqtt-dashboard.com',
    mqttTopicPrefix = 'EC544-Group2-Challenge1/temperature/';

// IMPORTANT: Use api_mode: 2 as the xbee-arduino library requires it
// Create the xbeeAPI object which handles parsing and generating of API frames
// C contains some Xbee constant bytes such as frame type, transmit/receive options, etc.

var xbeeOptions = {
        api_mode: 2
    },
    C = xbee_api.constants,
    xbeeAPI = new xbee_api.XBeeAPI(xbeeOptions);

// Serial port options
// This program requires you to manually give it the port name in the command line arguments
// Giving the xbeeAPI.rawParser() to the serial port ensures that the xbeeAPI object handles the serial input/output buffer
var portName = process.argv[2],
    openImmediately = true,
    serialOptions = {
        baudrate: 9600,
        parser: xbeeAPI.rawParser()
    };

// Create a serial port at the port name with the given serial options, open it immediately and call the callback function supplied
var Serial = new serialPort.SerialPort(portName, serialOptions, openImmediately, function() {
    console.log('Opened serial port');

    // Additional optional functionality to dump data to a MongoDB instance/ MQTT server
    var databaseConnected = false,
        mqttConnected = false,
        database = null;

    // Check if you have a mongod instance running on mongoURL and if you can connect to it
    console.log('Connecting to database server');
    MongoClient.connect(mongoURL, function(err, db) {
        if (err) console.log('Failed to connect to database server. Proceeding without database ....');
        else {
            console.log('Connected to database server');
            databaseConnected = true;
            database = db;
        }
    });

    // Check if the MQTT broker at mqttURL is accepting incoming connections
    var mqttClient = mqtt.connect(mqttURL);
    console.log('Connecting to MQTT server');
    mqttClient.on('connect', function() {
        console.log('Connected to MQTT server');
        mqttConnected = true;
    });

    // This attaches a asynchronous callback function to a 'frame_object' event that gets called when the xbeeAPI object parses a complete API frame on the serial port. The callback is called with the frame as an argument.
    xbeeAPI.on('frame_object', function(frame) {
        if (frame.type === C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET) {
            if (frame.data[0] === SET_HEARTBEAT) {
                // Update list of active nodes
                console.log('Received heartbeat from address64: ' + frame.address64);
            } else {
                data = buildDocument(frame);
                if (databaseConnected) insertDocument(data, database, 'temperature');
                if (mqttConnected) publishMQTT(data, mqttClient, mqttTopicPrefix + data.deviceID);
                if (!databaseConnected && !mqttConnected) console.log('<<', frame);
            }
        }
    });
    xbeeAPI.on('error', function(err) {
        console.log(err);
    })
    Serial.write(xbeeAPI.buildFrame(buildFrameObject(SET_PERIOD, '4000')));
    Serial.write(xbeeAPI.buildFrame(buildFrameObject(SET_SYNC)));
});

// Given a frame, create a structured object/document to insert into the database
function buildDocument(APIframe) {
    return {
        deviceID: APIframe.remote64,
        time: Date.now(),
        value: parseFloat(APIframe.data.toString('ascii'))
    };
}

// Insert document into specified collection in given database and report status
function insertDocument(doc, db, collect) {
    db.collection(collect).insertOne(doc, function(err, result) {
        if (err) console.log('Error in inserting document')
        else console.log('Inserted 1 documents in collection');
    });
}

// Publish JSON stringified payload to MQTT server at supplied topic
function publishMQTT(doc, mqttClient, topic) {
    mqttClient.publish(topic, JSON.stringify(doc), function() {
        console.log('Published MQTT message to topic: ' + topic);
    });
}

var SET_SYNC = 0xB0,
    SET_PERIOD = 0xB1,
    SET_HEARTBEAT = 0xB2;

function buildFrameObject(command) {
    var frameObject = {
        type: C.FRAME_TYPE.ZIGBEE_TRANSMIT_REQUEST,
        destination64: '000000000000ffff'
    }
    switch (command) {
        case SET_SYNC:
            var dataPayload = [0xB0];
            break;
        case SET_PERIOD:
            var dataPayload = [0xB1];
            if (arguments.length < 2) throw 'FRAME_COMMAND_ERROR: Specify period string in milliseconds';
            dataPayload.push.apply(dataPayload, arguments[1].split('').map(function(char) {
                return char.charCodeAt(0);
            }));
            dataPayload.push(0x00);
            console.log(dataPayload);
            break;
        case SET_HEARTBEAT:
            dataPayload = [0xB2];
        default:
            throw 'FRAME_COMMAND_ERROR: Invalid command issued to buildFrameObject(command)'
    }
    frameObject.data = dataPayload;
    return frameObject;
}
