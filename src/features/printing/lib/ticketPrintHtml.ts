import { ITicketRenderedLine } from "../types/ITicketData";
import {
  formatRenderedLine,
  stripBoldMarkers,
} from "./ticketLayout";

const LINE_HEIGHT_MM = 3.3;
const QR_BLOCK_MM = 28;
const PAGE_PADDING_MM = 6;

export function estimateTicketPageHeightMm(
  rendered: ITicketRenderedLine[],
  hasQrImage: boolean,
): number {
  let mm = PAGE_PADDING_MM;
  for (const line of rendered) {
    if (line.kind === "qr") {
      if (hasQrImage) mm += QR_BLOCK_MM;
      continue;
    }
    mm += LINE_HEIGHT_MM;
  }
  return Math.max(45, Math.ceil(mm));
}

function renderTextLineHtml(line: ITicketRenderedLine & { kind: "text" }, width: number): string {
  const { text: rawText, bold } = stripBoldMarkers(line.text);
  const text = formatRenderedLine(rawText, line.align, width).replace(/</g, "&lt;");
  const className = bold ? "line bold" : "line";
  return `<div class="${className}">${text || "&nbsp;"}</div>`;
}

/** HTML para imprimir ticket con texto y QR en el orden correcto */
export function buildTicketPrintHtmlFromRendered(
  rendered: ITicketRenderedLine[],
  width: number,
  anchoPapel: 58 | 80 = 58,
  qrDataUrl?: string,
): string {
  const pageHeightMm = estimateTicketPageHeightMm(rendered, !!qrDataUrl);

  const body = rendered
    .map((line) => {
      if (line.kind === "qr") {
        if (!qrDataUrl) return "";
        return `<div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Cuadre de Caja" /></div>`;
      }
      return renderTextLineHtml(line, width);
    })
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>Ticket</title>
<style>
  @page {
    size: ${anchoPapel}mm ${pageHeightMm}mm;
    margin: 0;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${anchoPapel}mm;
    max-width: ${anchoPapel}mm;
    height: auto;
    min-height: 0;
  }
  body {
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.2;
    padding: 2mm;
  }
  .line {
    white-space: pre;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
  .line.bold {
    font-weight: 700;
  }
  .qr-wrap {
    text-align: center;
    margin: 2px 0;
    line-height: 0;
  }
  .qr-wrap img {
    width: 22mm;
    height: 22mm;
    image-rendering: pixelated;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 2mm !important;
      width: ${anchoPapel}mm !important;
      max-width: ${anchoPapel}mm !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
    }
    .line {
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>${body}</body></html>`;
}
