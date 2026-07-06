import { ITicketPayload } from "../../types/ITicketData";
import {
  buildTicketLines,
  ticketLinesToStrings,
} from "../buildTicketLines";
import { encodeQrEscPos } from "./qrEncoder";
import {
  formatFeedLine,
  getCharsPerLine,
  stripBoldMarkers,
} from "../ticketLayout";

const ESC = 0x1b;
const GS = 0x1d;

function textEncoder(): TextEncoder {
  return new TextEncoder();
}

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

function line(text: string): Uint8Array {
  return textEncoder().encode(`${text}\n`);
}

export function encodeTicketToEscPos(payload: ITicketPayload): Uint8Array {
  const ancho = (payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  const rendered = buildTicketLines(payload);
  const parts: Uint8Array[] = [];

  parts.push(cmd(ESC, 0x40));

  let currentAlign: "left" | "center" = "left";

  for (const row of rendered) {
    if (row.kind === "qr") {
      if (currentAlign !== "center") {
        currentAlign = "center";
        parts.push(cmd(ESC, 0x61, 0x01));
      }
      parts.push(encodeQrEscPos(row.url));
      parts.push(line(""));
      continue;
    }

    if (row.kind === "feed") {
      if (currentAlign !== "left") {
        currentAlign = "left";
        parts.push(cmd(ESC, 0x61, 0x00));
      }
      parts.push(line(formatFeedLine(width)));
      continue;
    }

    if (row.align !== currentAlign) {
      currentAlign = row.align;
      parts.push(cmd(ESC, 0x61, currentAlign === "center" ? 0x01 : 0x00));
    }

    const { text: plainText } = stripBoldMarkers(row.text);
    const text =
      row.align === "center"
        ? plainText.slice(0, width)
        : ticketLinesToStrings(
            [{ ...row, text: plainText }],
            width,
          )[0] ?? plainText;

    parts.push(line(text));
  }

  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(cmd(0x0a));
  parts.push(cmd(GS, 0x56, 0x00));

  return concat(...parts);
}

/** Genera líneas de texto plano para vista previa / impresión navegador */
export function ticketPayloadToTextLines(payload: ITicketPayload): string[] {
  const ancho = (payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  return ticketLinesToStrings(buildTicketLines(payload), width);
}

export { buildTicketLines };
