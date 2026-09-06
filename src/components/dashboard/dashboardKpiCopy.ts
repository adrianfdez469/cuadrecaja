import { formatNumber } from "@/utils/formatters";

/**
 * What the merchant reads in the online-store cells of the dashboard KPI row.
 *
 * A `.ts` and not a `.tsx`, and that is the whole point: no symbol living in a
 * `.tsx` is importable from a test in this project (E-015), and the copy of
 * these two cells is what criterion 5 of F-024 rests on. Precedent for a plain
 * `.ts` of copy inside `components/`: `@/components/tiendaOnline/orderPresentation`.
 */

/** Label of the merchandise cell. Names a PART, never the whole channel. */
export const MERCANCIA_TIENDA_ONLINE_LABEL = "Mercancía de tienda online";

/** Label of the delivery cell. Names the other part. */
export const ENVIO_TIENDA_ONLINE_LABEL = "Envío de tienda online";

/**
 * Note under the delivery figure. Fixed, no branches.
 *
 * Deliberately the mirror image of `tiendaOnlineNote`: same closing phrase,
 * opposite preposition. Delivery is OUTSIDE `totalPeriodo` (ADR 0089), so
 * saying it is "already counted" would be false in the expensive direction —
 * a delivery charge that never gets reconciled.
 */
export const ENVIO_TIENDA_ONLINE_NOTE =
  "No está en el total de ventas: súmalo a la mercancía";

/**
 * The note under the merchandise figure, in its two written forms.
 *
 * It is not decoration: `totalMercanciaTiendaOnline` is PART of `totalPeriodo`,
 * and a figure sitting next to another figure in a KPI row reads as summable.
 * The note is what stops somebody from counting it twice (ADR 0075).
 *
 * It says `sin el envío` even when no order of the range charged any and the
 * delivery cell is not on screen: the sentence is true either way, and a note
 * that only shows up alongside a delivery charge teaches the rule solely to
 * whoever already has it in front of them.
 */
export function tiendaOnlineNote(cantidad: number): string {
  if (cantidad === 1) {
    return "1 venta, sin el envío. Ya contada en el total de ventas";
  }
  return `${formatNumber(cantidad)} ventas, sin el envío. Ya contadas en el total de ventas`;
}
