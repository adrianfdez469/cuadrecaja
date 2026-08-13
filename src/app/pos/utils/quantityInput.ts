export interface QuantityStepChip {
  value: number;
  label: string;
}

// Limpia el texto tecleado y lo limita a 2 decimales VISUALMENTE mientras
// se escribe (no solo al confirmar) — normaliza "," a "." (teclados
// numéricos en español), colapsa puntos de más a uno solo, y trunca la
// parte decimal a 2 dígitos.
export function sanitizeQuantityDraft(
  text: string,
  allowDecimal: boolean,
): string {
  if (!allowDecimal) {
    return text.replace(/[^0-9]/g, "");
  }

  const cleaned = text.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex === -1) return cleaned;

  const integerPart = cleaned.slice(0, dotIndex);
  const decimalPart = cleaned
    .slice(dotIndex + 1)
    .replace(/\./g, "")
    .slice(0, 2);
  return `${integerPart}.${decimalPart}`;
}

export function parseQuantityText(
  text: string,
  allowDecimal: boolean,
): number | null {
  const cleaned = allowDecimal
    ? text.replace(/[^0-9.]/g, "")
    : text.replace(/[^0-9]/g, "");

  if (cleaned === "" || cleaned === ".") return null;

  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
}

export function clampQuantity(
  value: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const rounded = allowDecimal
    ? Math.round(value * 100) / 100
    : Math.round(value);

  return Math.min(Math.max(rounded, min), max);
}

export function resolveCommittedQuantity(
  text: string,
  previousValue: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const parsed = parseQuantityText(text, allowDecimal);
  if (parsed === null) return previousValue;
  return clampQuantity(parsed, min, max, allowDecimal);
}

export function getStepChips(
  allowDecimal: boolean,
  showBulkChip10: boolean,
  showBulkChip50: boolean,
  showBulkChip100: boolean,
): QuantityStepChip[] {
  if (allowDecimal) {
    return [
      { value: 0.01, label: "0.01" },
      { value: 0.1, label: "0.1" },
      { value: 0.5, label: "0.5" },
      { value: 1, label: "1" },
    ];
  }

  const chips: QuantityStepChip[] = [{ value: 1, label: "1" }];
  if (showBulkChip10) chips.push({ value: 10, label: "10" });
  if (showBulkChip50) chips.push({ value: 50, label: "50" });
  if (showBulkChip100) chips.push({ value: 100, label: "100" });
  return chips;
}

// Always 1, even for decimal-allowed products — finer steps (0.1/0.5/0.01)
// are opt-in via the step chips, not the default, so a stray tap doesn't
// silently switch someone into fractional increments.
export function getDefaultStep(): number {
  return 1;
}
