import { TICKET_FOOTER_URL } from "@/constants/ticket";
import { ITicketPayload } from "../../types/ITicketData";
import {
  compactSeparator,
  formatAmountCompact,
  getCharsPerLine,
  padLine,
  wrapText,
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

function buildPaymentLines(payload: ITicketPayload, width: number): string[] {
  const lines: string[] = [];

  if (payload.pagosDetalle?.length) {
    for (const pago of payload.pagosDetalle) {
      const tipo = pago.tipo === "cash" ? "Efe" : "Trans";
      lines.push(
        padLine(
          `${tipo} ${pago.moneda}`,
          formatAmountCompact(pago.monto),
          width,
        ),
      );
    }
  } else {
    if (payload.totalCash > 0) {
      lines.push(
        padLine("Efe", formatAmountCompact(payload.totalCash), width),
      );
    }
    if (payload.totalTransfer > 0) {
      lines.push(
        padLine("Trans", formatAmountCompact(payload.totalTransfer), width),
      );
    }
  }

  if (payload.vueltoDetalle?.length) {
    for (const v of payload.vueltoDetalle) {
      if (v.monto > 0) {
        lines.push(
          padLine(
            `Vuel ${v.moneda}`,
            formatAmountCompact(v.monto),
            width,
          ),
        );
      }
    }
  }

  return lines;
}

export function encodeTicketToEscPos(payload: ITicketPayload): Uint8Array {
  const ancho = (payload.plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const width = getCharsPerLine(ancho);
  const parts: Uint8Array[] = [];

  parts.push(cmd(ESC, 0x40));
  parts.push(cmd(ESC, 0x61, 0x01));

  const headerLines = wrapText(
    payload.plantilla.encabezado?.trim() || payload.tiendaNombre,
    width,
    2,
  );
  for (const h of headerLines) {
    parts.push(line(h));
  }

  parts.push(cmd(ESC, 0x61, 0x00));

  let meta = `${payload.fechaCompacta} #${payload.ticketId}`;
  if (payload.cajeroNombre) {
    const cajero = payload.cajeroNombre.split(" ")[0]?.slice(0, 8) ?? "";
    meta = `${meta} ${cajero}`;
  }
  parts.push(line(meta.slice(0, width)));
  parts.push(line(compactSeparator(width)));

  for (const prod of payload.productos) {
    const left = `${prod.cantidad}x ${prod.nombreCompacto}`;
    const right = formatAmountCompact(prod.subtotal);
    parts.push(line(padLine(left, right, width)));
  }

  parts.push(line(compactSeparator(width)));
  parts.push(
    line(padLine("Tot", formatAmountCompact(payload.total), width)),
  );

  if (payload.discountCodes?.length) {
    const codes = payload.discountCodes.join(",");
    parts.push(line(`Desc ${codes}`.slice(0, width)));
  }

  for (const payLine of buildPaymentLines(payload, width)) {
    parts.push(line(payLine));
  }

  if (payload.plantilla.pie?.trim()) {
    const pieLines = wrapText(payload.plantilla.pie.trim(), width, 2);
    for (const pl of pieLines) {
      parts.push(line(pl));
    }
  }

  parts.push(cmd(ESC, 0x61, 0x01));
  parts.push(line(TICKET_FOOTER_URL));
  parts.push(cmd(ESC, 0x61, 0x00));
  parts.push(cmd(0x0a));
  parts.push(cmd(GS, 0x56, 0x00));

  return concat(...parts);
}

/** Genera líneas de texto plano para vista previa / impresión navegador */
export function ticketPayloadToTextLines(payload: ITicketPayload): string[] {
  const bytes = encodeTicketToEscPos(payload);
  const raw = new TextDecoder().decode(bytes);
  return raw
    .split("\n")
    .map((l) => l.replace(/\x1b./g, "").replace(/\x1d./g, "").trim())
    .filter((l, i, arr) => !(l === "" && i === arr.length - 1));
}
