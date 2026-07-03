import { TICKET_FEED_LINE_HEIGHT_MM } from "@/constants/ticket";
import { ITicketRenderedLine } from "../types/ITicketData";
import {
  formatFeedLine,
  formatRenderedLine,
  stripBoldMarkers,
} from "./ticketLayout";

function renderTextLineHtml(
  line: ITicketRenderedLine & { kind: "text" },
  width: number,
): string {
  const { text: rawText, bold } = stripBoldMarkers(line.text);
  if (!rawText.trim()) {
    return `<div class="line spacer"></div>`;
  }
  const text = formatRenderedLine(rawText, line.align, width).replace(/</g, "&lt;");
  const className = bold ? "line bold" : "line";
  return `<div class="${className}">${text}</div>`;
}

/** Puntos en ambos bordes + altura fija: el driver Windows no avanza papel en zonas vacías. */
function renderFeedLineHtml(width: number): string {
  const text = formatFeedLine(width).replace(/</g, "&lt;");
  return `<div class="feed-line">${text}</div>`;
}

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
      if (line.kind === "feed") {
        return renderFeedLineHtml(width);
      }
      return renderTextLineHtml(line, width);
    })
    .join("");

  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<title>Ticket</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${anchoPapel}mm;
    max-width: ${anchoPapel}mm;
    height: auto;
    min-height: 0;
  }
  #ticket-root {
    width: ${anchoPapel}mm;
    max-width: ${anchoPapel}mm;
    padding: 1mm 1.5mm 1mm;
    font-family: "Courier New", Courier, monospace;
    font-size: 11px;
    line-height: 1.15;
  }
  .line {
    white-space: pre;
    overflow: hidden;
    line-height: 1.15;
  }
  .line.spacer {
    height: 3px;
    line-height: 3px;
    font-size: 3px;
  }
  .line.bold {
    font-weight: 700;
  }
  .feed-line {
    display: block;
    height: ${TICKET_FEED_LINE_HEIGHT_MM}mm;
    min-height: ${TICKET_FEED_LINE_HEIGHT_MM}mm;
    line-height: ${TICKET_FEED_LINE_HEIGHT_MM}mm;
    white-space: pre;
    font-size: 10px;
    overflow: hidden;
  }
  .qr-wrap {
    text-align: center;
    margin: 1px 0;
    line-height: 0;
  }
  .qr-wrap img {
    width: 22mm;
    height: 22mm;
    image-rendering: pixelated;
  }
</style>
</head>
<body><div id="ticket-root">${body}</div></body></html>`;
}

/** ID del contenedor medido antes de imprimir (debe coincidir con el HTML generado). */
export const TICKET_PRINT_ROOT_ID = "ticket-root";
