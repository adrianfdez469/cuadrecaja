import {
  IPrintDeviceConfig,
  IPrinterConnection,
  PrinterTransportType,
} from "../types/IPrinterConfig";
import { ITicketPayload } from "../types/ITicketData";
import { BluetoothTransport } from "./bluetoothTransport";
import { BrowserFallbackTransport } from "./browserFallbackTransport";
import { IPrintTransport } from "./IPrintTransport";
import { NetworkTransport } from "./networkTransport";
import { WebSerialTransport } from "./webSerialTransport";

export function createTransport(
  config: IPrintDeviceConfig,
  payload?: ITicketPayload,
): IPrintTransport {
  switch (config.transportType) {
    case "bluetooth":
      return new BluetoothTransport(
        config.connection as Extract<IPrinterConnection, { deviceId: string }>,
      );
    case "usb_serial":
      return new WebSerialTransport(config);
    case "network":
      return new NetworkTransport(
        config.connection as Extract<IPrinterConnection, { host: string }>,
      );
    case "browser":
    default:
      return new BrowserFallbackTransport(payload);
  }
}

export function defaultDeviceConfig(tiendaId: string): IPrintDeviceConfig {
  return {
    tiendaId,
    autoPrint: false,
    copias: 1,
    transportType: "browser" as PrinterTransportType,
    connection: { configured: false },
  };
}
