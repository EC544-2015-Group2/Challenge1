#include <math.h>

const String deviceID = "0xff3b";
const String broadcastID = "0xffff";
const int thermPin = A0;

double Vout, Rth, temp;
unsigned long timestamp = 0, now, period = 1000;
String serialStr = "";
boolean serialStrComplete = false, sync = false;
char inChar;

void setup() {
  Serial.begin(9600);
  pinMode(thermPin, INPUT);
}

void loop() {
  while (Serial.available()) {
    inChar = (char) Serial.read();
    if (inChar == '\n') {
      serialStrComplete = true;
      break;
    } else serialStr += inChar;
  }

  if (serialStrComplete) {
    if (serialStr.startsWith(deviceID) || serialStr.startsWith(broadcastID)) {
      serialStr = serialStr.substring(7);
      if (serialStr.startsWith("SYNC")) {
        sync = true;
      } else if (serialStr.startsWith("SET")) {
        period = serialStr.substring(3).toInt();
      }
    }
    serialStrComplete = false;
    serialStr = "";
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
