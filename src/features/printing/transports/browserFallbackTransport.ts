import { IPrintTransport } from "./IPrintTransport";
import { buildTicketLines } from "../lib/buildTicketLines";
import { generateTicketMarketingQrDataUrl } from "../lib/generateTicketMarketingQr";
import { printHtmlSilently } from "../lib/printHtmlSilently";
import { buildTicketPrintHtmlFromRendered } from "../lib/ticketPrintHtml";
import { getCharsPerLine } from "../lib/ticketLayout";
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
    const ancho = (this.payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
    const width = getCharsPerLine(ancho);
    const rendered = buildTicketLines(this.payload);
    const qrDataUrl = await generateTicketMarketingQrDataUrl();
    const html = buildTicketPrintHtmlFromRendered(
      rendered,
      width,
      ancho,
      qrDataUrl,
    );
    await printHtmlSilently(html, { paperWidthMm: ancho });
  }
}
