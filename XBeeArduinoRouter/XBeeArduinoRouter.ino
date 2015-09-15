#include <XBee.h>
#include <math.h>

XBee xbee = XBee();
ZBRxResponse rx = ZBRxResponse();

uint8_t dataPayload[5];

XBeeAddress64 coordAddr64 = XBeeAddress64(0x00000000, 0x00000000);
ZBTxRequest zbDataTx = ZBTxRequest(coordAddr64, dataPayload, sizeof(dataPayload));

const int thermPin = A0;

double Vout, Rth, temp;
unsigned long timestamp = 0, now, period = 1000;
boolean sync = false;

void setup() {
  Serial.begin(9600);
  xbee.begin(Serial);
  pinMode(thermPin, INPUT);
}

void loop() {
  xbee.readPacket();
  if (xbee.getResponse().isAvailable()) {
    if (xbee.getResponse().getApiId() == ZB_RX_RESPONSE) {
      xbee.getResponse().getZBRxResponse(rx);
      switch(rx.getData(0)){
        case 0xB0:  //This signals a SYNC command
          sync = true;
          break;
        case 0xB1:  //This signals a command to set reporting period
          uint8_t* rxPayload = rx.getData();
          period = atoi((char*)++rxPayload);
          break;
      }
    }
  }

  now = millis();
  if ((now - timestamp) > period || sync) {
    sync = false;
    timestamp = now;
    Vout = analogRead(thermPin) / 1024.0 * 5;
    Rth = (50000 - 10000 * Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth), 3)) - 273.15;
    String(temp, 1).toCharArray((char*)((void*)dataPayload), 5);
    xbee.send(zbDataTx);
  }
}
