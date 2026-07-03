import { ITicketRenderedLine } from "../types/ITicketData";
import { formatRenderedLine } from "./ticketLayout";

/** HTML para imprimir ticket con texto y QR en el orden correcto */
export function buildTicketPrintHtmlFromRendered(
  rendered: ITicketRenderedLine[],
  width: number,
  anchoPapel: 58 | 80 = 58,
  qrDataUrl?: string,
): string {
  const body = rendered
    .map((line) => {
      if (line.kind === "qr") {
        if (!qrDataUrl) return "";
        return `<div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Cuadre de Caja" /></div>`;
      }
      const text = formatRenderedLine(line.text, line.align, width).replace(
        /</g,
        "&lt;",
      );
      return `<div class="line">${text || "&nbsp;"}</div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html><head><title>Ticket</title>
<style>
  @page { size: ${anchoPapel}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.25;
    margin: 0;
    padding: 2mm;
    width: ${anchoPapel}mm;
    max-width: ${anchoPapel}mm;
  }
  .line {
    white-space: pre;
    overflow: hidden;
    min-height: 1.25em;
  }
  .qr-wrap {
    text-align: center;
    margin: 4px 0;
  }
  .qr-wrap img {
    width: 22mm;
    height: 22mm;
    image-rendering: pixelated;
  }
</style></head>
<body>${body}</body></html>`;
}
