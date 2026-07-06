export type PrinterTransportType = "bluetooth" | "usb_serial" | "network" | "browser";

export interface IBluetoothConnection {
  deviceId: string;
  deviceName: string;
}

export interface IUsbSerialConnection {
  configured: boolean;
  baudRate?: number;
  portHint?: {
    usbVendorId?: number;
    usbProductId?: number;
    grantedIndex?: number;
    lastPortCount?: number;
  };
  lastPortCount?: number;
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
