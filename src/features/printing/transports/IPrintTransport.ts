import { PrinterTransportType } from "../types/IPrinterConfig";

export interface IPrintTransport {
  type: PrinterTransportType;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  print(data: Uint8Array): Promise<void>;
}
