import { formatCurrency } from "@/utils/formatters";

/**
 * The one sentence that says what a close defers. The closing screen's banner
 * and the confirmation dialog both render this, so the two can never drift.
 *
 * With `count === 0` no amount is named: `formatCurrency(0)` returns `$0.00`
 * through its falsy branch, and announcing "por $0.00" would say the same
 * nothing twice.
 *
 * Its own module, and a `.ts` one: a symbol living in a `.tsx` is not
 * importable from a test (E-015).
 */
export function formatDeferredSalesNotice(
  count: number,
  total: number,
): string {
  if (count === 0) return "Ninguna venta queda para el próximo período.";
  if (count === 1)
    return `1 venta pasa al próximo período, por ${formatCurrency(total)}.`;
  return `${count} ventas pasan al próximo período, por ${formatCurrency(total)}.`;
}
