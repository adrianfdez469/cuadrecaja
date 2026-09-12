/**
 * THE one rule for `Cliente.telefono`: phone numbers made of digits with an optional
 * leading `+`, separated by commas — and nothing else. Both writing surfaces (the quick
 * create of the POS selector and the settings form) and the Zod schemas read it from here,
 * so the rule cannot drift between the UI and the API.
 */

/** Full-match pattern: `+5353334449`, `533334449`, `+5353334449,534319958`. */
export const CLIENTE_TELEFONO_REGEX = /^\+?[0-9]+(?:,\+?[0-9]+)*$/;

/** The message `createClienteSchema` answers with when the pattern fails. */
export const CLIENTE_TELEFONO_MESSAGE =
  "El teléfono solo admite números separados por comas (ej: +5353334449,534319958)";

/**
 * PURE. What the field tolerates WHILE TYPING: every other character is dropped, `+` only
 * survives at the head of a number — even before its first digit arrives, so a value CAN
 * start with `+` — and runs of commas collapse to one, with no leading comma. A trailing
 * comma and a still digit-less `+` survive on purpose: they are the user opening the next
 * number, and it is `hasClienteTelefonoError`/`normalizeClienteTelefono` that judge them.
 */
export function sanitizeClienteTelefono(raw: string): string {
  const stripped = raw.replace(/[^0-9+,]/g, "");
  const parts = stripped.split(",").map((part) => {
    const digits = part.replace(/\+/g, "");
    return part.startsWith("+") ? `+${digits}` : digits;
  });
  const collapsed = parts.join(",").replace(/,{2,}/g, ",");
  return collapsed.startsWith(",") ? collapsed.slice(1) : collapsed;
}

/**
 * PURE. The submit-time check: the WHOLE value must match the pattern. The empty string is
 * valid — the field is optional, and `toStoredClienteText` is the one that turns it into
 * null before persisting.
 */
export function isValidClienteTelefono(value: string): boolean {
  return value === "" || CLIENTE_TELEFONO_REGEX.test(value);
}

/**
 * PURE. The FIELD-level error signal: true when the value is non-empty and would not
 * persist as-is — a `+` that no digit follows. ONE exception, on purpose: a single
 * trailing comma is the user opening the next number, not a defect, and the error waits
 * until the state is more than that.
 */
export function hasClienteTelefonoError(value: string): boolean {
  if (value === "") return false;
  const candidate = value.endsWith(",") ? value.slice(0, -1) : value;
  return !isValidClienteTelefono(candidate);
}

/**
 * PURE. What gets sent on submit: only the numbers that carry at least one digit — a
 * dangling `+`, a trailing comma and any empty segment opened on the way are dropped.
 * Legacy rows written before this rule ("+53 5 3334 449") normalize here too
 * ("+5353334449"), which is what lets them be edited and saved again under the stricter
 * schema.
 */
export function normalizeClienteTelefono(raw: string): string {
  return sanitizeClienteTelefono(raw)
    .split(",")
    .filter((part) => /[0-9]/.test(part))
    .join(",");
}
