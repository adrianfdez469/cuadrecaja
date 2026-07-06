import { TICKET_STOP_WORDS } from "@/constants/ticket";

function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function truncateWord(word: string): string {
  if (word.length <= 4) return word;
  return word.slice(0, 4);
}

/**
 * Compacta nombres largos omitiendo stop words y truncando palabras.
 * Ej: "Pasta de Dientes Artesanal Caribe Bello" → "Pasta Dient Art Car Bell"
 */
export function compactProductName(nombre: string, maxChars: number): string {
  const normalized = normalizeText(nombre);
  if (!normalized) return "";

  const words = normalized
    .split(" ")
    .filter((w) => w.length > 0 && !TICKET_STOP_WORDS.has(w.toLowerCase()));

  if (words.length === 0) {
    return normalized.slice(0, maxChars);
  }

  let compact = words.map(truncateWord).join(" ");

  if (compact.length <= maxChars) {
    return compact;
  }

  const compactWords = compact.split(" ");
  while (compactWords.length > 1 && compactWords.join(" ").length > maxChars) {
    compactWords.pop();
  }

  compact = compactWords.join(" ");
  if (compact.length <= maxChars) {
    return compact;
  }

  return compact.slice(0, maxChars);
}
