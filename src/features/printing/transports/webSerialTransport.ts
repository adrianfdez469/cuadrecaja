import { IPrintTransport } from "./IPrintTransport";

const DEFAULT_BAUD = 9600;

export class WebSerialTransport implements IPrintTransport {
  type = "usb_serial" as const;
  private port: SerialPort | null = null;

  isConnected(): boolean {
    return !!this.port?.readable && !!this.port?.writable;
  }

  async connect(): Promise<void> {
    if (!navigator.serial) {
      throw new Error("Web Serial no disponible en este navegador");
    }

    if (this.isConnected()) return;

    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: DEFAULT_BAUD });
    this.port = port;
  }

  async disconnect(): Promise<void> {
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.port?.writable) {
      await this.connect();
    }
    if (!this.port?.writable) {
      throw new Error("Puerto serial no conectado");
    }

    const writer = this.port.writable.getWriter();
    try {
      const chunkSize = 512;
      for (let i = 0; i < data.length; i += chunkSize) {
        await writer.write(data.slice(i, i + chunkSize));
      }
    } finally {
      writer.releaseLock();
    }
  }
}
