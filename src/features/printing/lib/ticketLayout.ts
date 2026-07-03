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
const UNIT_PRICE_INDENT = "  ";

export function getPriceColumnWidth(amounts: number[]): number {
  let maxLen = 4;
  for (const amount of amounts) {
    maxLen = Math.max(maxLen, formatTicketAmount(amount).length);
  }
  return maxLen + PRICE_GAP;
}

export function wrapProductBlock(
  qty: number,
  nombre: string,
  precioUnit: number,
  subtotal: number,
  width: number,
  priceColWidth: number,
): string[] {
  const lines: string[] = [];
  const qtyPrefix = `${qty} `;
  const nameAreaFirst = width - priceColWidth - qtyPrefix.length;
  const nameAreaCont = width - priceColWidth - CONTINUATION_INDENT;

  let remaining = nombre.trim();
  const subtotalStr = formatTicketAmount(subtotal);

  if (remaining.length <= nameAreaFirst) {
    lines.push(padLine(qtyPrefix + remaining, subtotalStr, width));
  } else {
    const firstPart = remaining.slice(0, nameAreaFirst);
    lines.push(padLine(qtyPrefix + firstPart, subtotalStr, width));
    remaining = remaining.slice(nameAreaFirst);

    while (remaining.length > 0) {
      const chunk = remaining.slice(0, nameAreaCont);
      lines.push(`${" ".repeat(CONTINUATION_INDENT)}${chunk}`);
      remaining = remaining.slice(nameAreaCont);
    }
  }

  lines.push(`${UNIT_PRICE_INDENT}${formatTicketAmount(precioUnit)}`);
  return lines;
}

export function formatRenderedLine(
  text: string,
  align: "left" | "center",
  width: number,
): string {
  if (!text) return "";
  return align === "center" ? centerLine(text, width) : text;
}

/** Convierte marcadores `** texto **` usados en encabezados del ticket */
export function stripBoldMarkers(text: string): { text: string; bold: boolean } {
  const match = text.match(/^\*\*\s*(.+?)\s*\*\*$/);
  if (match) return { text: match[1], bold: true };
  return { text, bold: false };
}
