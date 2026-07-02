import { INetworkConnection } from "../types/IPrinterConfig";
import { IPrintTransport } from "./IPrintTransport";

export class NetworkTransport implements IPrintTransport {
  type = "network" as const;

  constructor(private readonly connection: INetworkConnection) {}

  isConnected(): boolean {
    return !!this.connection.host;
  }

  async connect(): Promise<void> {
    if (!this.connection.host?.trim()) {
      throw new Error("IP de impresora no configurada");
    }
  }

  async disconnect(): Promise<void> {
    // Conexión HTTP sin estado persistente
  }

  async print(data: Uint8Array): Promise<void> {
    const { host, port, path } = this.connection;
    const urlPath = path?.trim() || "/";
    const url = `http://${host.trim()}:${port || 9100}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: data,
      mode: "no-cors",
    });

    if (response.type === "opaque") {
      return;
    }

    if (!response.ok) {
      throw new Error(`Error de red al imprimir (${response.status})`);
    }
  }
}
