#include <Printers.h>
#include <XBee.h>

#include <math.h>


XBee xbee = XBee();
XBeeResponse response = XBeeResponse();
//ZBRxResponse rx = ZBRxResponse();
ModemStatusResponse msr = ModemStatusResponse();

uint8_t introPayload[] = {'{', 't', 'e', 'm', 'p', '}'};  
uint8_t dataPayload[5];

XBeeAddress64 coordAddr64 = XBeeAddress64(0x00000000, 0x00000000);
ZBTxRequest zbIntroTx = ZBTxRequest(coordAddr64, introPayload, sizeof(introPayload));
ZBTxRequest zbDataTx = ZBTxRequest(coordAddr64, dataPayload, sizeof(dataPayload));

const int thermPin = A0;

double Vout, Rth, temp;
unsigned long timestamp = 0, now, period = 1000;
boolean introMessageSent = false, sync = false;

void setup() {
  Serial.begin(9600);
  xbee.begin(Serial);
  xbee.send(zbIntroTx);
  //  pinMode(thermPin, INPUT);
}

void loop() {
  xbee.readPacket();
  if (xbee.getResponse().isAvailable()) {
    if (xbee.getResponse().getApiId() == MODEM_STATUS_RESPONSE) {
      xbee.getResponse().getModemStatusResponse(msr);
      if (msr.getStatus() == ASSOCIATED)
        xbee.send(zbIntroTx);
    }
  }

  now = millis();
  if ((now - timestamp) > period || sync) {
    sync = false;
    timestamp = now;
    Vout = analogRead(thermPin) / 1024.0 * 5;
    Rth = (50000 - 10000 * Vout) / Vout;
    temp = 1 / (0.001129148 + 0.000234125 * log(Rth) + 8.76741E-08 * pow(log(Rth), 3)) - 273.15;
    char tempArr[4];
    String(temp,1).toCharArray(tempArr,5);
    memcpy(dataPayload, tempArr, 5);
    xbee.send(zbDataTx);
  }
}
