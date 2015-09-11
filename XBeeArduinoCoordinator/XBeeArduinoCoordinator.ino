#include <math.h>
#include <SoftwareSerial.h>
SoftwareSerial XBee(2, 3); //RX, TX

const int deviceID = 0xff3c;
const int thermPin = A0;
double Vout;
double Rth;
double temp;
double tempC;
double tempF;
String inputString = "";
String inputXBee = "";
boolean stringComplete;
boolean xbeeComplete;
boolean sync = false;
unsigned long timestamp = 0, now, period = 1000;

void setup() {
  pinMode(thermPin, INPUT);
  Serial.begin(9600);

}

void loop() {
  now = millis();
  if ((now - timestamp) > period || sync) {
    sync = false;
    timestamp = now;
    Vout = analogRead(thermPin) / 1024.0 * 5;
    Rth = (50000 - 10000 *Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth),3)) - 273.15;
    Serial.print(deviceID);
    Serial.print(",");
    Serial.print(tempC);
  }
  if (Serial.available()) {
    while (Serial.available()) {
      char inChar = (char)Serial.read();
      inputString += inChar;
      if (inChar == '\n') {
        stringComplete = true;
      }
    }
    XBee.print(inputString);
  }
  if (XBee.available()) {
    while (XBee.available()) {
      char inXBee = (char)XBee.read();
      inputXBee += inXBee;
      if (inXBee == '\n') {
        xbeeComplete = true;
      }
    }
    Serial.print(inputXBee);
  }
}

