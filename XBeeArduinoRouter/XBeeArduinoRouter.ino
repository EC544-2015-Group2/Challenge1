#include <math.h>
const String deviceID = "0xff3b";

String inputString = "";
boolean stringComplete = false, sync = false;

const int tempPin = A0;
double Vout, Rth, temp;
unsigned long timestamp = 0, now, period = 1000;

void setup() {
  Serial.begin(9600);
  pinMode(tempPin, INPUT);
}

void loop() {
  now = millis();
  if ((now - timestamp) > period || sync) {
    sync = false;
    timestamp = now;
    Vout = analogRead(tempPin) / 1024.0 * 5;
    Rth = (50000 - 10000 * Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth), 3)) - 273.15;
    Serial.print(deviceID);
    Serial.print(',');
    Serial.println(temp, 1);
  }
  if (stringComplete) {
    if (inputString.startsWith(deviceID) || inputString.startsWith("0xffff")) {
      inputString = inputString.substring(7);
      if (inputString.startsWith("SYNC")) {
        sync = true;
      } else if (inputString.startsWith("SET")) {
        period = inputString.substring(3).toInt();
      }
    }
    stringComplete = false;
    inputString = "";
  }
}

void serialEvent() {
  while (Serial.available()) {
    char inChar = (char) Serial.read();
    inputString += inChar;
    if (inChar == '\n')
      stringComplete = true;
  }
}
