#include <math.h>
#include <SoftwareSerial.h>

const String deviceID = "0xff3c";
const String broadcastID = "0xffff";
const int thermPin = A0;

SoftwareSerial XBee(2, 3); //RX, TX
double Vout, Rth, temp;
unsigned long timestamp = 0, now, period = 1000;
String serialStr = "", xbeeStr = "";
boolean serialStrComplete = false, xbeeStrComplete = false;
boolean sync = false;
char inChar;

void setup() {
  pinMode(thermPin, INPUT);
  Serial.begin(9600);
  XBee.begin(9600);
}

void loop() {
  while (Serial.available()) {
    inChar = (char)Serial.read();
    if (inChar == '\n') {
      serialStrComplete = true;
      break;
    } else serialStr += inChar;
  }
  if (serialStrComplete) {
    if (serialStr.startsWith(deviceID) || serialStr.startsWith(broadcastID)) {
      if (serialStr.startsWith(broadcastID))
        XBee.println(serialStr);
      serialStr = serialStr.substring(7);
      if (serialStr.startsWith("SYNC")) {
        sync = true;
        XBee.println("0xffff,SYNC");
      } else if (serialStr.startsWith("SET")) {
        period = serialStr.substring(3).toInt();
        XBee.println(String("0xffff,SET" + String(period)));
      }
    }
    serialStr = "";
    serialStrComplete = false;
  }


  while (XBee.available()) {
    inChar = (char)XBee.read();
    if (inChar == '\n') {
      xbeeStrComplete = true;
      break;
    } else xbeeStr += inChar;
  }
  if (xbeeStrComplete) {
    Serial.println(xbeeStr);
    xbeeStr = "";
    xbeeStrComplete = false;
  }


  now = millis();
  if ((now - timestamp) > period || sync) {
    sync = false;
    timestamp = now;
    Vout = analogRead(thermPin) / 1024.0 * 5;
    Rth = (50000 - 10000 * Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth), 3)) - 273.15;
    Serial.println(String(deviceID + "," + String(temp,1)));
  }
}
