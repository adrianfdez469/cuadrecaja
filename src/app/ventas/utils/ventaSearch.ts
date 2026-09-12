import { matchesSaleSearchTerm } from "@/lib/venta/saleHistoryFilter";

/** The fields the search reads. Structural, so an IVenta satisfies it without a cast. */
export interface IVentaSearchable {
  id?: string;
  createdAt: Date | string;
  /** The selling device's own clock; absent on rows synced before it existed. */
  frontendCreatedAt?: Date | string | null;
  clienteNombre?: string;
  usuario?: { nombre?: string };
  productos?: Array<{ name?: string }>;
}

/**
 * PURE. Whether a sale matches a free-text term, case-insensitively.
 *
 * It lives in a `.ts` and not inside `page.tsx` because no symbol of a `.tsx` is importable from
 * a test (E-015), and criterion 4 is exactly a predicate test.
 *
 * It matches, and the list is exhaustive: the sale id, its formatted date, its formatted date and
 * time, the names of its products, the seller's name, and — NEW in F-037 — `clienteNombre`, the
 * debtor of a credit sale (criterion 4).
 *
 * An empty or whitespace-only term matches every sale, which is what the screen shows today with
 * an empty box.
 *
 * The matching itself is DELEGATED to matchesSaleSearchTerm (F-049): the sales history has one
 * definition of what a term matches, and that definition formats the REPORTED instant of the sale
 * — the one the rows display since F-047 — with the same formatDate / formatDateTime the row
 * renders, so a date the user can read is a date the user can search. This wrapper only keeps the
 * contract F-037 verified: the trimmed empty term, the null guard, and the wire-shaped timestamps
 * (`createdAt` crosses the wire as a string even though the type says Date, E-074).
 */
export function matchesVentaSearch(
  venta: IVentaSearchable,
  term: string,
): boolean {
  const needle = (term ?? "").trim();
  if (needle.length === 0) return true;
  if (!venta) return false;

  return matchesSaleSearchTerm(
    {
      ...venta,
      createdAt: new Date(venta.createdAt),
      frontendCreatedAt: venta.frontendCreatedAt
        ? new Date(venta.frontendCreatedAt)
        : undefined,
    },
    needle,
  );
}
