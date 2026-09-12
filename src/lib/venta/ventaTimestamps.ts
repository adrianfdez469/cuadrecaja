import type { IVenta } from "@/schemas/venta";
import type { SaleTimestamps } from "@/lib/venta/saleTime";

/**
 * The two timestamp fields of a sale as they arrive from the network: typed as
 * Date by the Zod schema, but still ISO strings at runtime, because getSells
 * hands the response through unparsed.
 */
export type VentaTimestampSource = Pick<
  IVenta,
  "createdAt" | "frontendCreatedAt"
>;

/**
 * Coerces an unparsed IVenta into the SaleTimestamps that saleTime.ts expects.
 *
 * This is a boundary adapter and nothing else: it does NOT choose between the
 * two instants. Choosing stays in saleReportedAt / saleEffectiveAt, which are
 * the single definition of a sale's time.
 *
 * The truthiness guard covers the three shapes the field can take at runtime -
 * an ISO string, undefined, or null - and maps the last two to null, which is
 * what SaleTimestamps declares.
 */
export function toSaleTimestamps(venta: VentaTimestampSource): SaleTimestamps {
  return {
    createdAt: new Date(venta.createdAt),
    frontendCreatedAt: venta.frontendCreatedAt
      ? new Date(venta.frontendCreatedAt)
      : null,
  };
}
