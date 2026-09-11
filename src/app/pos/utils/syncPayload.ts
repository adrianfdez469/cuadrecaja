import type { Sale } from "@/store/salesStore";
import type { IMultimonedaExtras } from "@/schemas/pago";

/**
 * The currency a queued sale falls back to when it carries none. Same value the three call
 * sites already wrote inline, and the same one the two sale routes default `monedaBase` to.
 * Module-private on purpose: it is a fallback of this rebuild, not a project-wide default.
 */
const FALLBACK_MONEDA_COBRO = "CUP";

/**
 * The multimoneda payload of a queued sale, rebuilt from what the POS stored.
 *
 * THE ONLY place that does it. It used to be written out field by field in three places —
 * the background sweep and the two manual re-sends of the sales drawer — and the three had
 * already drifted: the two manual ones dropped the tip. A field added to a sale and not to
 * all three arrives as a sale that never had it.
 *
 * Returns undefined when the sale carries no payment lines at all, which is what the three
 * call sites already checked for. An EMPTY array is not absent: a 100 % credit sale carries
 * `pagosDetalle: []` and does produce a payload. That is the difference that makes criterion
 * 8 pass.
 */
export function buildSyncMultimoneda(
  sale: Sale,
): IMultimonedaExtras | undefined {
  if (!sale.pagosDetalle) return undefined;

  return {
    monedaCobro: sale.monedaCobro ?? FALLBACK_MONEDA_COBRO,
    pagosDetalle: sale.pagosDetalle,
    vueltoDetalle: sale.vueltoDetalle ?? [],
    tasaSnapshot: sale.tasaSnapshot ?? {},
    ...(sale.tipTotal && sale.tipTotal > 0
      ? { tipTotal: sale.tipTotal, tipDetail: sale.tipDetail ?? [] }
      : {}),
    ...(sale.creditoBase && sale.creditoBase > 0
      ? {
          creditoBase: sale.creditoBase,
          ...(sale.clienteId ? { clienteId: sale.clienteId } : {}),
          ...(sale.clienteNombre
            ? { clienteNombre: sale.clienteNombre }
            : {}),
        }
      : {}),
  };
}
