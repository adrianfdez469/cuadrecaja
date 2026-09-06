import { z } from "zod";
import {
  QAB_ORDER_URL_MAX_LENGTH,
  QAB_ORDER_URL_REQUIRED_PREFIX,
  QAB_ORDER_WHATSAPP_HOST,
} from "@/constants/qab";

/**
 * PURE. The buyer's link as it is safe to hand a browser, or `null`.
 *
 * THE definition, and the only one: the response schema below and the detail
 * mapper both call THIS, so the rule is never paraphrased (E-014).
 *
 * It answers `null` in EXACTLY these five cases, and this list is the contract:
 *
 *   1. `value` is null or empty.
 *   2. Longer than QAB_ORDER_URL_MAX_LENGTH. Checked BEFORE parsing, so an
 *      absurd string never reaches the parser.
 *   3. Does not start with QAB_ORDER_URL_REQUIRED_PREFIX.
 *   4. `new URL(value)` throws.
 *   5. Its `hostname` is not QAB_ORDER_WHATSAPP_HOST.
 *
 * Case 5 is the point of this function and case 3 is not enough on its own:
 * QAB_ORDER_URL_REQUIRED_PREFIX is `https://`, which every address on the
 * internet satisfies. `hostname` is compared and NOT the raw text, so an address
 * that carries the expected host as USERINFO — before an `@` — and
 * `attacker.example` as its real host does not pass; and a mixed-case host does,
 * because `URL` already lowercases it.
 *
 * Case 4 runs inside a `catch` THAT BINDS NOTHING. Verified by running it, not
 * assumed: on Node 22 the `TypeError` reads exactly "Invalid URL" and does NOT
 * quote the value — but the error OBJECT carries it in `error.input`, so
 * `console.error(error)` or any serialisation of it publishes the raw value.
 * Binding nothing removes the question (E-031).
 *
 * On success it returns the INPUT STRING VERBATIM, never `url.href`: the
 * prefilled `?text=` is QAB's, and normalising it would rewrite a message
 * nobody asked us to touch.
 */
export function toSafeWhatsappUrl(value: string | null): string | null {
  if (value === null || value.length === 0) return null;
  if (value.length > QAB_ORDER_URL_MAX_LENGTH) return null;
  if (!value.startsWith(QAB_ORDER_URL_REQUIRED_PREFIX)) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (url.hostname !== QAB_ORDER_WHATSAPP_HOST) return null;
  return value;
}

/**
 * The published field. `.refine` over `toSafeWhatsappUrl` and NOT a second
 * predicate: one rule, one place. The mapper guarantees it, so a hand-edited row
 * turns into `null` instead of failing the whole detail response.
 */
export const qabWhatsappUrlSchema = z
  .string()
  .refine((value) => toSafeWhatsappUrl(value) !== null);
