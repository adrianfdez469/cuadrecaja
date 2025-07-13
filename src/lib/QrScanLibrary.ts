import { Html5Qrcode, Html5QrcodeCameraScanConfig, QrcodeErrorCallback, QrcodeSuccessCallback } from 'html5-qrcode';

// const backCameraSelection = { facingMode: { exact: '' } };
const backCameraSelection = { facingMode: 'user' };

const config: Html5QrcodeCameraScanConfig = {
  fps: 24, // Optional, frame per seconds for qr code scanning
  qrbox: { width: 200, height: 200 }, // Optional, if you want bounded box UI
  disableFlip: true //
};

let html5QrCodeInstance: Html5Qrcode;

export function init(containerId: string) {
  return (html5QrCodeInstance = new Html5Qrcode(containerId));
}

export async function start(qrCodeSuccessCallback: QrcodeSuccessCallback, qrCodeErrorCallback: QrcodeErrorCallback) {
  return html5QrCodeInstance.start(backCameraSelection, config, qrCodeSuccessCallback, qrCodeErrorCallback);
  // .catch((err) => {
  //   console.error('Error at start QR scanning process',err);
  // });
}

export async function stop() {
  return html5QrCodeInstance
    .stop()
    .then(() => {
      console.log('Closed QR scanning process');
    })
    .catch((err) => {
      console.error('Error stopping QR scanning process', err);
      // Stop failed, handle it.
    });
}
