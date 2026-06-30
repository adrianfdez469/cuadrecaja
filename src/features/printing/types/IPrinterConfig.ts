export type PrinterTransportType = "bluetooth" | "usb_serial" | "network" | "browser";

export interface IBluetoothConnection {
  deviceId: string;
  deviceName: string;
}

export interface IUsbSerialConnection {
  /** Indicador de que el puerto fue configurado (no se puede persistir el handle) */
  configured: boolean;
  label?: string;
}

export interface INetworkConnection {
  host: string;
  port: number;
  path?: string;
}

export type IPrinterConnection =
  | IBluetoothConnection
  | IUsbSerialConnection
  | INetworkConnection;

export interface IPrintDeviceConfig {
  tiendaId: string;
  autoPrint: boolean;
  copias: number;
  transportType: PrinterTransportType;
  connection: IPrinterConnection;
  lastConnectedAt?: number;
}

export interface IPrintCapabilities {
  bluetooth: boolean;
  usbSerial: boolean;
  network: boolean;
}
