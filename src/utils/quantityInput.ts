/**
 * Quantity input helpers, shared by the POS and by inventory management.
 *
 * They live outside the POS because every screen that types a quantity has the
 * same two problems: a Spanish mobile keypad emits "," where `parseFloat`
 * expects ".", and stock is a Float that must not grow a third decimal.
 */

export interface QuantityQuickChip {
  /** How much this chip adds to what is already on screen. */
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

/**
 * Rounds to the 2 decimals the inputs accept and `formatQuantity` prints.
 *
 * Stock is a Float built by adding and subtracting, so it drifts: subtracting a
 * typed 8.7 from a stored 8.699999999999999 yields 1e-15, which is not "no
 * change" to a raw comparison and would record a movement out of nothing.
 */
export function roundQuantity(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

export function clampQuantity(
  value: number,
  min: number,
  max: number,
  allowDecimal: boolean,
): number {
  const rounded = allowDecimal ? roundQuantity(value) : Math.round(value);

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

/**
 * The shortcuts above the keypad, as the redesign draws them.
 *
 * They add to the figure on screen; they used to choose a *step* for a pair of
 * «−N / +N» buttons that no longer exist. «+10 / +50 / +100» is the drawing's
 * set for a whole unit, and a fraction gets the box it is broken out of
 * («Caja × 20») because that is the quantity a cashier actually types for one.
 *
 * Anything the shop cannot supply is left out rather than shown disabled: a
 * chip that adds more than what is left would only ever clamp.
 */
export function getQuickAddChips(
  allowDecimal: boolean,
  available: number,
  unitsPerBox?: number | null,
): QuantityQuickChip[] {
  if (allowDecimal) {
    return [
      { value: 0.1, label: "+0,1" },
      { value: 0.5, label: "+0,5" },
      { value: 1, label: "+1" },
    ].filter((chip) => chip.value <= available);
  }

  const chips: QuantityQuickChip[] = [10, 50, 100]
    .filter((value) => value <= available)
    .map((value) => ({ value, label: `+${value}` }));

  if (
    typeof unitsPerBox === "number" &&
    unitsPerBox >= 2 &&
    unitsPerBox <= available &&
    !chips.some((chip) => chip.value === unitsPerBox)
  ) {
    chips.push({ value: unitsPerBox, label: `Caja × ${unitsPerBox}` });
  }

  // Four is what the row fits at 390px without any of them shrinking below
  // the 44px the redesign gives them.
  return chips.slice(0, 4);
}
