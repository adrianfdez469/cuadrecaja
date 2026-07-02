import { TICKET_CHARS_PER_LINE } from "@/constants/ticket";

export function getCharsPerLine(anchoPapel: 58 | 80): number {
  return TICKET_CHARS_PER_LINE[anchoPapel] ?? TICKET_CHARS_PER_LINE[58];
}

/** Espacio reservado para cantidad, precio y separadores en línea de producto */
export function getMaxProductNameChars(anchoPapel: 58 | 80): number {
  const lineWidth = getCharsPerLine(anchoPapel);
  return Math.max(8, lineWidth - 12);
}

export function padLine(
  left: string,
  right: string,
  width: number,
): string {
  const trimmedLeft = left.slice(0, width - right.length - 1);
  const spaces = Math.max(1, width - trimmedLeft.length - right.length);
  return `${trimmedLeft}${" ".repeat(spaces)}${right}`;
}

export function compactSeparator(width: number): string {
  const count = Math.min(width, 24);
  return "-".repeat(count);
}

export function formatTicketDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${mins}`;
}

export function shortTicketId(syncId: string): string {
  return syncId.replace(/-/g, "").slice(-8);
}

export function formatAmountCompact(amount: number): string {
  return amount.toLocaleString("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n").filter(Boolean);

  for (const paragraph of paragraphs) {
    let remaining = paragraph.trim();
    while (remaining.length > 0 && lines.length < maxLines) {
      if (remaining.length <= maxChars) {
        lines.push(remaining);
        break;
      }
      lines.push(remaining.slice(0, maxChars));
      remaining = remaining.slice(maxChars).trim();
    }
    if (lines.length >= maxLines) break;
  }

  return lines.slice(0, maxLines);
}
