/**
 * Pure copy helpers of the SSO card (F-009).
 *
 * It imports nothing, so no cycle is possible (E-028), and it is a plain `.ts`
 * so the suite can import it (E-015).
 */

/**
 * PURE. The countdown label of the SSO card: `Caduca en {n} s`, with
 * `n = Math.max(0, Math.floor(secondsLeft))`.
 *
 * No date, no `Intl`, no pluralisation, no locale lookup — it is a template with
 * one number in it. A negative or fractional input yields a floored, clamped
 * one, so a throttled background tab cannot render `Caduca en -3 s`.
 *
 * It lives in a plain `.ts` under `src/utils/` and NOT next to the module's
 * other copy helpers in `src/components/tiendaOnline/`: those sit beside the
 * component that owns them, this one is pure formatting with no component of its
 * own. It is a `.ts` either way, which is what E-015 demands.
 */
export function formatQabSsoExpiry(secondsLeft: number): string {
  return `Caduca en ${Math.max(0, Math.floor(secondsLeft))} s`;
}
