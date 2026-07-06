import { DEFAULT_SERIAL_BAUD_RATE } from "@/constants/ticket";

export interface ISerialPortHint {
  usbVendorId?: number;
  usbProductId?: number;
  grantedIndex?: number;
  lastPortCount?: number;
}

export interface ISerialOpenOptions {
  baudRate: number;
  portHint?: ISerialPortHint;
}

const WRITE_CHUNK_SIZE = 512;
const POST_WRITE_DELAY_MS = 80;

const ESC = 0x1b;
const GS = 0x1d;

function cmd(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function portIsOpen(port: SerialPort): boolean {
  return !!port.readable && !!port.writable;
}

function hintsMatch(a: ISerialPortHint, b: ISerialPortHint): boolean {
  if (
    a.grantedIndex !== undefined &&
    b.grantedIndex !== undefined &&
    a.grantedIndex === b.grantedIndex
  ) {
    return true;
  }
  if (
    a.usbVendorId !== undefined &&
    a.usbProductId !== undefined &&
    a.usbVendorId === b.usbVendorId &&
    a.usbProductId === b.usbProductId
  ) {
    return true;
  }
  return false;
}

export function getPortHint(port: SerialPort, grantedIndex?: number): ISerialPortHint {
  const info = port.getInfo();
  return {
    usbVendorId: info.usbVendorId,
    usbProductId: info.usbProductId,
    ...(grantedIndex !== undefined ? { grantedIndex } : {}),
  };
}

export function mapSerialError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Error desconocido al usar el puerto serie. Revise la consola (F12).";
  }

  const msg = error.message.toLowerCase();

  if (error.name === "NotFoundError") {
    return "Selección de puerto cancelada.";
  }

  if (
    msg.includes("failed to open serial port") ||
    msg.includes("failed to open") ||
    error.name === "NetworkError"
  ) {
    return (
      "No se pudo abrir el puerto COM: probablemente está ocupado por Windows u otro programa. " +
      "Quite la impresora de «Impresoras y escáneres» en Windows o cierre el software que use ese COM, luego vuelva a emparejar."
    );
  }

  if (error.name === "InvalidStateError") {
    return (
      "El puerto serie ya está en uso (otra pestaña o programa). " +
      "Cierre otras ventanas del POS o pulse «Desconectar puerto» y vuelva a intentar."
    );
  }

  return `${error.message}. Si persiste, abra la consola del navegador (F12) para más detalle.`;
}

/** Ticket mínimo ESC/POS para probar una velocidad (baud). */
export function encodeBaudTestTicket(baudRate: number): Uint8Array {
  const line = `PRUEBA ${baudRate}\n`;
  return concat(
    cmd(ESC, 0x40),
    new TextEncoder().encode(line),
    cmd(0x0a),
    cmd(GS, 0x56, 0x00),
  );
}

class SerialPortManagerImpl {
  private boundPort: SerialPort | null = null;
  private currentBaudRate: number | null = null;
  private portHint: ISerialPortHint | null = null;

  isOpen(): boolean {
    return !!this.boundPort && portIsOpen(this.boundPort);
  }

  getPortHint(): ISerialPortHint | null {
    return this.portHint;
  }

  getCurrentBaudRate(): number | null {
    return this.currentBaudRate;
  }

  async requestAndBind(baudRate: number = DEFAULT_SERIAL_BAUD_RATE): Promise<ISerialPortHint> {
    if (!navigator.serial) {
      throw new Error("Web Serial no disponible en este navegador. Use Chrome o Edge.");
    }

    const port = await navigator.serial.requestPort();
    const allPorts = await navigator.serial.getPorts();
    const grantedIndex = allPorts.indexOf(port);
    const hint = getPortHint(port, grantedIndex >= 0 ? grantedIndex : undefined);

    await this.bindPort(port, baudRate, {
      ...hint,
      lastPortCount: allPorts.length,
    });

    return this.portHint!;
  }

  async bindPort(
    port: SerialPort,
    baudRate: number,
    hint?: ISerialPortHint,
  ): Promise<void> {
    if (this.boundPort && this.boundPort !== port && portIsOpen(this.boundPort)) {
      await this.release();
    }

    this.boundPort = port;
    if (hint) {
      this.portHint = { ...hint, lastPortCount: hint.lastPortCount };
    } else {
      this.portHint = getPortHint(port);
    }

    await this.openPort(port, baudRate);
  }

  async ensureOpen(options: ISerialOpenOptions): Promise<void> {
    const { baudRate, portHint } = options;

    if (!navigator.serial) {
      throw new Error("Web Serial no disponible en este navegador. Use Chrome o Edge.");
    }

    if (this.boundPort && portIsOpen(this.boundPort)) {
      if (this.currentBaudRate !== baudRate) {
        await this.release();
      } else {
        return;
      }
    }

    const resolved = await this.resolvePort(portHint ?? this.portHint ?? undefined);
    this.boundPort = resolved;
    if (portHint) {
      this.portHint = { ...portHint };
    }

    await this.openPort(resolved, baudRate);
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.boundPort?.writable) {
      throw new Error("Puerto serial no conectado");
    }

    const writer = this.boundPort.writable.getWriter();
    try {
      for (let i = 0; i < data.length; i += WRITE_CHUNK_SIZE) {
        await writer.write(data.slice(i, i + WRITE_CHUNK_SIZE));
      }
      await sleep(POST_WRITE_DELAY_MS);
    } finally {
      writer.releaseLock();
    }
  }

  async release(): Promise<void> {
    if (this.boundPort) {
      try {
        if (portIsOpen(this.boundPort)) {
          await this.boundPort.close();
        }
      } catch {
        // ignorar error al cerrar
      }
    }
    this.boundPort = null;
    this.currentBaudRate = null;
  }

  private async resolvePort(hint?: ISerialPortHint): Promise<SerialPort> {
    if (!navigator.serial) {
      throw new Error("Web Serial no disponible");
    }

    if (this.boundPort) {
      const ports = await navigator.serial.getPorts();
      if (ports.includes(this.boundPort)) {
        return this.boundPort;
      }
    }

    const ports = await navigator.serial.getPorts();

    if (hint?.grantedIndex !== undefined && ports[hint.grantedIndex]) {
      return ports[hint.grantedIndex];
    }

    if (
      hint?.usbVendorId !== undefined &&
      hint?.usbProductId !== undefined
    ) {
      const byUsb = ports.find((p) => {
        const info = p.getInfo();
        return (
          info.usbVendorId === hint.usbVendorId &&
          info.usbProductId === hint.usbProductId
        );
      });
      if (byUsb) return byUsb;
    }

    if (this.portHint) {
      const bySaved = ports.find((p) =>
        hintsMatch(getPortHint(p, ports.indexOf(p)), this.portHint!),
      );
      if (bySaved) return bySaved;
    }

    if (ports.length === 1) {
      return ports[0];
    }

    if (ports.length > 1 && hint?.grantedIndex !== undefined) {
      return ports[hint.grantedIndex] ?? ports[0];
    }

    if (ports.length > 0) {
      return ports[0];
    }

    return navigator.serial.requestPort();
  }

  private async openPort(port: SerialPort, baudRate: number): Promise<void> {
    if (portIsOpen(port)) {
      if (this.currentBaudRate === baudRate && this.boundPort === port) {
        return;
      }
      try {
        await port.close();
      } catch {
        // continuar
      }
    }

    try {
      await port.open({
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
        flowControl: "none",
      });
    } catch (error) {
      throw new Error(mapSerialError(error));
    }

    this.boundPort = port;
    this.currentBaudRate = baudRate;
  }
}

export const serialPortManager = new SerialPortManagerImpl();
