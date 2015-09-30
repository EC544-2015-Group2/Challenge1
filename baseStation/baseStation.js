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
 * call events, and parse the API frames. The program then aggregates readings arriving in a small interval
 * into one document and publishes the JSON at the supplied topic URL. 
 *
 *
 * XBEE -----> serialport -----> xbee-api ------> mqtt
 *
 *
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
    mqtt = require('mqtt');

var mqttURL = 'mqtt://broker.mqttdashboard.com',
    mqttTopic = 'EC544Group2_Challenge2';

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
    Serial.flush();

    // Check if the MQTT broker at mqttURL is accepting incoming connections
    var mqttClient = mqtt.connect(mqttURL);
    mqttClient.on('connect', function() {
        console.log('Connected to MQTT server');

        // Create variables to store device IDs and data
        var readingsList = null;
        var deviceList = [];

        // Create timer variables to keep track of time during periods
        var timestamp = Date.now(); // change to date.now()
        var remainingPeriod = 15000;

        // This attaches a asynchronous callback function to a 'frame_object' event that gets called when the xbeeAPI object parses a complete API frame on the serial port. The callback is called with the frame as an argument.
        xbeeAPI.on('frame_object', function(frame) {
            if (frame.type === C.FRAME_TYPE.NODE_IDENTIFICATION) {
                deviceList.push(frame.remote64);
                remainingPeriod = 15000 - (Date.now() - timestamp);
                Serial.write(xbeeAPI.buildFrame(buildFrameObject(SET_PERIOD, remainingPeriod)));
            } else if (frame.type === C.FRAME_TYPE.ZIGBEE_RECEIVE_PACKET) {
                if (!readingsList) {
                    readingsList = {
                        time: Date.now(),
                        temperatures: []
                    };
                    setTimeout(function() {
                        readingsList.temperatures = readingsList.temperatures.sort();
                        mqttClient.publish(mqttTopic, JSON.stringify(readingsList));
                        Serial.write(xbeeAPI.buildFrame(buildFrameObject(SET_PERIOD, '15000')));
                        timestamp = Date.now();

                        if (readingsList.temperatures.length > deviceList.length) {
                            console.log('ERROR: Extra device found! Temperature data included and sent.');
                        } else if (readingsList.temperature.length < deviceList.length) {
                            console.log('ERROR: One or more devices has not sent data!')
                        };
                        deviceList = readingsList.temperatures.map(function(item) {
                            return item.deviceID;
                        });
                        readingsList = null;
                    }, 5000);
                }
                readingsList.temperatures.push({
                    deviceID: frame.remote64,
                    value: parseFloat(frame.data.toString('ascii'))
                });
            }
        });
        xbeeAPI.on('error', function(err) {
            console.log('ERROR: Xbee API Checksum mismatch');
        });
        Serial.flush();
    });
});

var SET_SYNC = 0xB0,
    SET_PERIOD = 0xB1;

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
            break;
        default:
            throw 'FRAME_COMMAND_ERROR: Invalid command issued to buildFrameObject(command)'
    }
    frameObject.data = dataPayload;
    return frameObject;
}
