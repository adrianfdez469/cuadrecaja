import { DEFAULT_SERIAL_BAUD_RATE } from "@/constants/ticket";
import { IPrintDeviceConfig } from "../types/IPrinterConfig";
import { IPrintTransport } from "./IPrintTransport";
import {
  ISerialPortHint,
  serialPortManager,
} from "../lib/serialPortManager";

function getSerialOptions(config: IPrintDeviceConfig): {
  baudRate: number;
  portHint?: ISerialPortHint;
} {
  const conn = config.connection;
  if (!("configured" in conn)) {
    return { baudRate: DEFAULT_SERIAL_BAUD_RATE };
  }

  return {
    baudRate: conn.baudRate ?? DEFAULT_SERIAL_BAUD_RATE,
    portHint: conn.portHint,
  };
}

export class WebSerialTransport implements IPrintTransport {
  type = "usb_serial" as const;

  constructor(private readonly config: IPrintDeviceConfig) {}

  isConnected(): boolean {
    return serialPortManager.isOpen();
  }

  async connect(): Promise<void> {
    const { baudRate, portHint } = getSerialOptions(this.config);
    await serialPortManager.ensureOpen({ baudRate, portHint });
  }

  async disconnect(): Promise<void> {
    await serialPortManager.release();
  }

  async print(data: Uint8Array): Promise<void> {
    const { baudRate, portHint } = getSerialOptions(this.config);
    await serialPortManager.ensureOpen({ baudRate, portHint });
    await serialPortManager.write(data);
  }
}
