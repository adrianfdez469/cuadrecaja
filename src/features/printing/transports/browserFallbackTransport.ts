import { IPrintTransport } from "./IPrintTransport";
import { ticketPayloadToTextLines } from "../lib/escpos/encoder";
import { ITicketPayload } from "../types/ITicketData";

let lastPreviewPayload: ITicketPayload | null = null;

export function getLastPreviewPayload(): ITicketPayload | null {
  return lastPreviewPayload;
}

export class BrowserFallbackTransport implements IPrintTransport {
  type = "browser" as const;
  private payload: ITicketPayload | null = null;

  constructor(payload?: ITicketPayload) {
    this.payload = payload ?? null;
  }

  setPayload(payload: ITicketPayload) {
    this.payload = payload;
  }

  isConnected(): boolean {
    return true;
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async print(data: Uint8Array): Promise<void> {
    void data;
    if (!this.payload) {
      throw new Error("Sin datos de ticket para vista previa");
    }

    lastPreviewPayload = this.payload;
    const lines = ticketPayloadToTextLines(this.payload);
    const html = `
      <!DOCTYPE html>
      <html><head><title>Ticket</title>
      <style>
        body { font-family: monospace; font-size: 12px; margin: 8px; width: 58mm; }
        pre { margin: 0; white-space: pre-wrap; }
      </style></head>
      <body><pre>${lines.map((l) => l.replace(/</g, "&lt;")).join("\n")}</pre>
      <script>window.onload = () => { window.print(); }</script>
      </body></html>`;

    const win = window.open("", "_blank", "width=320,height=600");
    if (!win) {
      throw new Error("No se pudo abrir ventana de impresión. Permita ventanas emergentes.");
    }
    win.document.write(html);
    win.document.close();
  }
}
