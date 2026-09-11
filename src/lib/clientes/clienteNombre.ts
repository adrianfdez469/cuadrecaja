/**
 * Trims the name and collapses runs of whitespace into a single space. It does NOT fold case
 * and does NOT strip accents: what this returns is what gets stored and what the composite
 * unique index compares, so folding here would change what the user typed.
 *
 * Consequence, written on purpose: two names differing only in case or in accents remain two
 * rows. Merging two clientes is out of scope for this feature (notes of F-033).
 */
export function normalizeClienteNombre(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Trims an optional text field down to what the column stores: a value, or null. Same rule for
 * `descripcion`, `direccion` and `telefono`, in the one place all three writers read it from.
 */
export function toStoredClienteText(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
