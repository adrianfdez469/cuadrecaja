export interface QuantityStepChip {
  value: number;
  label: string;
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

export function getDefaultStep(allowDecimal: boolean): number {
  return allowDecimal ? 0.1 : 1;
}
