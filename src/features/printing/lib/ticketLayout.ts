import { TICKET_CHARS_PER_LINE } from "@/constants/ticket";
import { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";

export function getCharsPerLine(anchoPapel: 58 | 80): number {
  return TICKET_CHARS_PER_LINE[anchoPapel] ?? TICKET_CHARS_PER_LINE[58];
}

export function padLine(left: string, right: string, width: number): string {
  const trimmedLeft = left.slice(0, width - right.length - 1);
  const spaces = Math.max(1, width - trimmedLeft.length - right.length);
  return `${trimmedLeft}${" ".repeat(spaces)}${right}`;
}

export function centerLine(text: string, width: number): string {
  const trimmed = text.slice(0, width);
  const pad = Math.max(0, Math.floor((width - trimmed.length) / 2));
  return `${" ".repeat(pad)}${trimmed}`;
}

export function fullSeparator(width: number, char: "=" | "-"): string {
  return char.repeat(width);
}

export function formatTicketDateFull(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function shortTicketId(syncId: string): string {
  return syncId.replace(/-/g, "").slice(-8);
}

/** Formato ticket: miles con punto, decimales con coma (ej. 500.000.000,00) */
export function formatTicketAmount(amount: number): string {
  return amount.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Tasas siempre expresadas contra CUP (1 XXX = Y CUP) */
export function formatTasaLine(moneda: string, tasas: ITasaSnapshot): string {
  const rateInCup =
    moneda === "CUP"
      ? 1
      : (tasas[moneda] ?? convertToBase(1, moneda, tasas, "CUP"));
  const formatted = formatTicketAmount(rateInCup);
  return `1 ${moneda} = ${formatted} CUP`;
}

const PRICE_GAP = 2;
const CONTINUATION_INDENT = 3;
/** Espacios entre el precio unitario y el borde derecho (no alinear con el subtotal). */
const UNIT_PRICE_RIGHT_GAP = 4;
const ELLIPSIS = "...";

export function getPriceColumnWidth(amounts: number[]): number {
  let maxLen = 4;
  for (const amount of amounts) {
    maxLen = Math.max(maxLen, formatTicketAmount(amount).length);
  }
  return maxLen + PRICE_GAP;
}

/**
 * Cada producto ocupa exactamente 2 líneas:
 * 1) cantidad + nombre + subtotal (alineado al borde derecho)
 * 2) continuación del nombre (si cabe) + precio unitario, con UNIT_PRICE_RIGHT_GAP
 *    espacios desde el último dígito del precio hasta el borde derecho
 */
export function wrapProductBlock(
  qty: number,
  nombre: string,
  precioUnit: number,
  subtotal: number,
  width: number,
  priceColWidth: number,
): string[] {
  const qtyPrefix = `${qty} `;
  const nameAreaFirst = Math.max(1, width - priceColWidth - qtyPrefix.length);
  const subtotalStr = formatTicketAmount(subtotal);
  const unitPriceStr = formatTicketAmount(precioUnit);
  // Precio unitario + margen derecho (no alinear con el subtotal de la línea 1)
  const unitPriceWithGap =
    unitPriceStr + " ".repeat(UNIT_PRICE_RIGHT_GAP);

  let remaining = nombre.trim();
  let line1Name: string;
  if (remaining.length <= nameAreaFirst) {
    line1Name = remaining;
    remaining = "";
  } else {
    line1Name = remaining.slice(0, nameAreaFirst);
    remaining = remaining.slice(nameAreaFirst);
  }

  const line1 = padLine(qtyPrefix + line1Name, subtotalStr, width);

  const maxLeftLen = Math.max(0, width - unitPriceWithGap.length - 1);
  const maxNameOnLine2 = Math.max(0, maxLeftLen - CONTINUATION_INDENT);

  let line2Left = "";
  if (remaining.length > 0 && maxNameOnLine2 > 0) {
    const indent = " ".repeat(CONTINUATION_INDENT);
    if (remaining.length <= maxNameOnLine2) {
      line2Left = indent + remaining;
    } else if (maxNameOnLine2 <= ELLIPSIS.length) {
      line2Left = indent + ELLIPSIS.slice(0, maxNameOnLine2);
    } else {
      line2Left =
        indent +
        remaining.slice(0, maxNameOnLine2 - ELLIPSIS.length) +
        ELLIPSIS;
    }
  }

  const line2 = padLine(line2Left, unitPriceWithGap, width);
  return [line1, line2];
}

export function formatRenderedLine(
  text: string,
  align: "left" | "center",
  width: number,
): string {
  if (!text) return "";
  return align === "center" ? centerLine(text, width) : text;
}

/** Puntos de avance de papel en ambos bordes (simétrico). */
export function formatFeedLine(width: number): string {
  return padLine(".", ".", width);
}

/** Convierte marcadores `** texto **` usados en encabezados del ticket */
export function stripBoldMarkers(text: string): { text: string; bold: boolean } {
  const match = text.match(/^\*\*\s*(.+?)\s*\*\*$/);
  if (match) return { text: match[1], bold: true };
  return { text, bold: false };
}
