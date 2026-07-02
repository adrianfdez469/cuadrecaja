import { IPrintTransport } from "./IPrintTransport";
import { ticketPayloadToTextLines } from "../lib/escpos/encoder";
import { printHtmlSilently } from "../lib/printHtmlSilently";
import { buildTicketPrintHtml } from "../lib/ticketPrintHtml";
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
    const html = buildTicketPrintHtml(lines);
    await printHtmlSilently(html);
  }
}
