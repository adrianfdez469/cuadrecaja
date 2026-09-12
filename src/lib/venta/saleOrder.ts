import { saleReportedAt, type SaleTimestamps } from "@/lib/venta/saleTime";

/**
 * The two timestamps of a sale plus its identity. Ordering needs one field
 * more than telling the time does, which is why this lives here and not in
 * saleTime.ts: that module declares its input and keeps it closed.
 */
export interface SaleOrderKey extends SaleTimestamps {
  /** Venta.id — a uuid primary key, unique and immutable. */
  id: string;
}

/**
 * PURE. THE order of the sales history: newest REPORTED instant first, ties
 * broken by id.
 *
 * The primary key is saleReportedAt, CALLED and never re-expressed: an absent
 * frontendCreatedAt is not a special case here at all, because that function
 * already resolves it to createdAt. Re-implementing `frontendCreatedAt ?? …`
 * or treating the absence as 0 / Infinity would bunch every pre-column sale at
 * one end of the list, which is worse than the disorder this fixes (E-014,
 * E-039, acceptance criterion 9).
 *
 * The secondary key is `id`, ASCENDING, compared with < and > over UTF-16 code
 * units. It exists because two sales can report the exact same instant
 * (acceptance criterion 3) and neither Postgres nor Array.prototype.sort makes
 * that pair's order reproducible on its own: findMany leaves the order of
 * equal rows unspecified, and a stable sort only preserves whatever order it
 * was handed. Venta.id is a unique primary key, so this key alone is a total
 * order and the result is identical on every request.
 *
 * NEVER localeCompare: its result depends on the ICU collation available at
 * runtime, which is not the same guarantee.
 *
 * DESC is the whole reading direction of the screen and is not a parameter:
 * one direction, one definition.
 */
export function compareSalesByReportedAtDesc(
  a: SaleOrderKey,
  b: SaleOrderKey,
): number {
  const reportedA = saleReportedAt(a).getTime();
  const reportedB = saleReportedAt(b).getTime();
  if (reportedA !== reportedB) return reportedB - reportedA;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}
