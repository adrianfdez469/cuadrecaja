import { IBluetoothConnection } from "../types/IPrinterConfig";
import { IPrintTransport } from "./IPrintTransport";

const SPP_SERVICE = "00001101-0000-1000-8000-00805f9b34fb";
const ALT_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa7-af769b42df14",
];

export class BluetoothTransport implements IPrintTransport {
  type = "bluetooth" as const;
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;

  constructor(private readonly connection: IBluetoothConnection) {}

  isConnected(): boolean {
    return !!this.device?.gatt?.connected && !!this.characteristic;
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error("Bluetooth no disponible en este navegador");
    }

    if (this.isConnected()) return;

    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SPP_SERVICE] }],
      optionalServices: [SPP_SERVICE, ...ALT_SERVICES],
      ...(this.connection.deviceId
        ? { acceptAllDevices: true as const }
        : {}),
    });

    this.device = device;
    const server = await device.gatt?.connect();
    if (!server) throw new Error("No se pudo conectar al dispositivo Bluetooth");

    const services = await server.getPrimaryServices();
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;

    for (const service of services) {
      const chars = await service.getCharacteristics();
      const writable = chars.find(
        (c) => c.properties.write || c.properties.writeWithoutResponse,
      );
      if (writable) {
        characteristic = writable;
        break;
      }
    }

    if (!characteristic) {
      throw new Error("No se encontró característica de escritura en la impresora");
    }

    this.characteristic = characteristic;
  }

  async disconnect(): Promise<void> {
    this.device?.gatt?.disconnect();
    this.device = null;
    this.characteristic = null;
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.characteristic) {
      await this.connect();
    }
    if (!this.characteristic) {
      throw new Error("Impresora Bluetooth no conectada");
    }

    const chunkSize = 512;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      if (this.characteristic.properties.writeWithoutResponse) {
        await this.characteristic.writeValueWithoutResponse(chunk);
      } else {
        await this.characteristic.writeValue(chunk);
      }
    }
  }
}
