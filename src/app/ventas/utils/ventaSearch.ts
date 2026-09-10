import { formatDate, formatDateTime } from "@/utils/formatters";

/** The fields the search reads. Structural, so an IVenta satisfies it without a cast. */
export interface IVentaSearchable {
  id?: string;
  createdAt: Date | string;
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
 * time, the names of its products, the seller's name, and — NEW in F-035 — `clienteNombre`, the
 * debtor of a credit sale (criterion 4).
 *
 * An empty or whitespace-only term matches every sale, which is what the screen shows today with
 * an empty box.
 *
 * The two formatted forms come from formatDate / formatDateTime (src/utils/formatters.ts), the
 * same functions the row renders, so a date the user can read is a date the user can search.
 */
export function matchesVentaSearch(
  venta: IVentaSearchable,
  term: string,
): boolean {
  const needle = (term ?? "").trim().toLowerCase();
  if (needle.length === 0) return true;
  if (!venta) return false;

  // `createdAt` crosses the wire as a string even though the type says Date (E-070), so it is
  // normalized here instead of trusting the declared type.
  const createdAt = new Date(venta.createdAt);

  const haystacks = [
    venta.id ?? "",
    formatDate(createdAt),
    formatDateTime(createdAt),
    (venta.productos ?? []).map((p) => p?.name ?? "").join(" "),
    venta.usuario?.nombre ?? "",
    venta.clienteNombre ?? "",
  ];

  return haystacks.some((value) => value.toLowerCase().includes(needle));
}
