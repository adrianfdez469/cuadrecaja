/**
 * The character-set bound of every text a receipt printer is ever handed.
 *
 * THIS MODULE IS A LEAF AND HAS TO STAY ONE: it imports nothing, from anywhere. It is
 * imported by `src/schemas/pago.ts`, `src/schemas/cliente.ts` and
 * `src/features/printing/lib/buildTicketLines.ts`; importing anything from `src/schemas/**`
 * back would close a value cycle between modules that evaluate schemas at the top level,
 * with `tsc` green and a Zod `TypeError` at load time (E-028).
 *
 * What it does NOT promise (E-017): it does not stop ESC/POS bytes from reaching the
 * printer. `encodeTicketToEscPos` emits `ESC` on purpose — alignment, cut, QR — and that is
 * its job. What this guarantees is that none of them comes from the text of a field.
 */

/**
 * Bytes that a receipt printer reads as commands rather than as text: C0 (\x00-\x1F,
 * ESC among them), DEL, and the C1 range (\x80-\x9F).
 *
 * THE ONLY declaration of the range in the project. Two expressions instead of one because
 * a RegExp with the /g flag carries `lastIndex` between calls, and a shared instance used
 * for both `.test` and `.replace` answers differently on alternate calls.
 */
export const CONTROL_CHARACTERS_PATTERN = /[\x00-\x1F\x7F-\x9F]/;

/** The same range with the /g flag, for `stripControlCharacters` and for nothing else. */
const CONTROL_CHARACTERS_GLOBAL_PATTERN = /[\x00-\x1F\x7F-\x9F]/g;

/** True when `value` carries at least one of them. Non-strings answer false. */
export function hasControlCharacters(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return CONTROL_CHARACTERS_PATTERN.test(value);
}

/**
 * `value` with every one of them removed — NOT replaced by a space: a control byte is not a
 * word separator, and turning it into one would change column widths that padLine already
 * computed. Non-strings answer "".
 */
export function stripControlCharacters(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARACTERS_GLOBAL_PATTERN, "");
}

/**
 * What a rejected name is answered with. A FIXED string with no interpolation: echoing back
 * the value that failed puts a control sequence into the logs and into the response, which
 * is the very thing being refused (E-031).
 */
export const CONTROL_CHARACTERS_MESSAGE =
  "El nombre contiene caracteres no permitidos";
