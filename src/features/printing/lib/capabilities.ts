import { IPrintCapabilities } from "../types/IPrinterConfig";

export function getPrintCapabilities(): IPrintCapabilities {
  if (typeof window === "undefined") {
    return { bluetooth: false, usbSerial: false, network: true };
  }

  return {
    bluetooth: "bluetooth" in navigator,
    usbSerial: "serial" in navigator,
    network: true,
  };
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}
