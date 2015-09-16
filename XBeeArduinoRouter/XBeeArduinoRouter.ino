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
* This is an Arduino program for sensing the voltage output of a voltage divider circuit
*
* (5V) ----/\/\/\/\/\------/\/\/\/\/\---- (GND)
*             Rth       |     10K
*                       |
*                     Vout
*
* and calculates the thermistor resistance,
* then maps it to temperature using the Steinhart-Hart equation
*
* This code uses the xbee-arduino library by Andrew Rapp (https://github.com/andrewrapp/xbee-arduino)
* for parsing and generating XBee API frames. The payload in the received data frames is of the structure
* [(Command byte) (Payload byte 1) (Payload byte 2) ...]
* where command byte can be
* 0xB0 - Synchronize command
* 0xB1 - Set sensing interval (this should be followed by null terminated string containing an integer set period in ms)
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


#include <XBee.h>
#include <math.h>

// The arduino pin connected to thermistor voltage input through voltage bridge
const int thermPin = A0;

// Predefined command bytes for synchronizing Arduinos and setting sensing interval
const uint8_t SET_SYNC = 0xB0;
const uint8_t SET_PERIOD = 0xB1;

// Sensed voltage, calculated thermistor resistance, and calculated temperature
double Vout, Rth, temp;

// Timing variables
unsigned long timestamp = 0, now, period = 1000;

boolean sync = false;   // Flag for forcing sense reading to synchronize Arduinos
uint8_t dataPayload[5];   // Preallocated memory location for sending in transmit API frame

// Xbee object, 64 bit coordinator address object, response API frame parsing object and transmit API frame generator object
XBee xbee = XBee();
XBeeAddress64 coordAddr64 = XBeeAddress64(0x00000000, 0x00000000);
ZBRxResponse rx = ZBRxResponse();
ZBTxRequest zbDataTx = ZBTxRequest(coordAddr64, dataPayload, sizeof(dataPayload));

void setup() {
  Serial.begin(9600);
  xbee.begin(Serial);   // This ensures that Xbee object manages serial input/ouput buffer through library functions
  pinMode(thermPin, INPUT);
}

void loop() {

  // Read the serial buffer for a complete API frame and if one is available, check if it is of type data received. If it is, then parse it's properties such as source address, data payload, etc.
  xbee.readPacket();
  if (xbee.getResponse().isAvailable()) {
    if (xbee.getResponse().getApiId() == ZB_RX_RESPONSE) {
      xbee.getResponse().getZBRxResponse(rx);

      // See the first byte of the data payload to see what command is transmitted
      switch (rx.getData(0)) {
        case SET_SYNC:
          sync = true;    // Set the sync flag to force reading update
          break;
        case SET_PERIOD:
          // Get pointer to data payload, increment it to discard first byte (command byte), cast it to (char*) and find out what number it contains using atoi() (e.g. atoi('1000') returns integer 1000)
          uint8_t* rxPayload = rx.getData();
          char* periodString = (char*)++rxPayload;
          period = atoi(periodString);
          break;
      }
    }
  }

  // Get current clock time in ms and refresh sensor reading if either time period has elapsed or if synchronize command has been received
  now = millis();

  if ((now - timestamp) > period || sync) {
    timestamp = now;
    sync = false;
    // Calculate Vout from Vin and ADC resolution, then calculate Rth from voltage-divider equation and finally use Steinhart-Hart equation to map thermistor resistance to sensed temperature
    Vout = analogRead(thermPin) / 1024.0 * 5;
    Rth = (50000 - 10000 * Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth), 3)) - 273.15;

    //  Generate string of temperature to 1 decimal place and copy its chars to the data payload memory address (the void* cast is required to go from uint8_t* to char*), then generate API frame and output through serial port
    String(temp, 1).toCharArray((char*)((void*)dataPayload), 5);
    xbee.send(zbDataTx);
  }
}
