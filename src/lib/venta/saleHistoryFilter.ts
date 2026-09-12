import { formatDate, formatDateTime } from "@/utils/formatters";
import { saleReportedAt } from "@/lib/venta/saleTime";
import {
  toSaleTimestamps,
  type VentaTimestampSource,
} from "@/lib/venta/ventaTimestamps";
import type { ISaleHistoryEmptyReason } from "@/constants/venta";

/**
 * The fields the sales-history search reads, declared structurally so this
 * module states its own input instead of depending on the whole IVenta.
 *
 * It extends VentaTimestampSource because the search matches against the
 * FORMATTED reported instant, and that adapter is what turns the two raw
 * fields into the SaleTimestamps saleReportedAt expects.
 */
export interface SaleHistorySearchFields extends VentaTimestampSource {
  id?: string;
  productos?: { name?: string }[];
  usuario?: { nombre?: string };
  /** The debtor of a credit sale, searchable since F-037 (criterion 4). */
  clienteNombre?: string;
}

/**
 * PURE. Whether one sale matches the free-text search of the sales history.
 *
 * MOVED VERBATIM out of src/app/ventas/page.tsx, where this was the body of an
 * inline filter. Behaviour is preserved to the letter, including the parts that
 * look like slips and are NOT to be tidied up:
 *
 * - the user name folds case with toLocaleLowerCase while every other field
 *   uses toLowerCase. Case folding is semantics, not formatting: normalising
 *   the two would silently change which rows a term matches.
 * - `id` is read defensively even though the schema types it as required.
 * - the term is NOT trimmed. A single space stays an active term, and it does
 *   match every sale: formatDateTime joins its two halves with " " + BULLET +
 *   " " (verified in the body of src/utils/formatters.ts, not in its JSDoc).
 *
 * An EMPTY term matches every sale: "".includes("") is true, which is what
 * makes the search-off state the identity of this predicate.
 *
 * The date fields are matched as the user READS them, so the comparison runs
 * against formatDate/formatDateTime output and inherits their locale and their
 * granularity — never against a hand-written date literal.
 *
 * `clienteNombre` is the one field added AFTER the move: F-037 made the debtor
 * of a credit sale searchable, and its predicate (matchesVentaSearch in
 * src/app/ventas/utils/ventaSearch.ts) delegates here so the screen has ONE
 * definition of what a term matches, and that definition reads the reported
 * instant the rows display, not the sync stamp.
 */
export function matchesSaleSearchTerm(
  sale: SaleHistorySearchFields,
  searchTerm: string,
): boolean {
  const searchLower = searchTerm.toLowerCase();
  const ventaId = sale.id?.toLowerCase() || "";
  const reportedAt = saleReportedAt(toSaleTimestamps(sale));
  const ventaDate = formatDate(reportedAt).toLowerCase();
  const ventaTime = formatDateTime(reportedAt).toLowerCase();
  const ventaProductos =
    sale.productos?.map((p) => p.name?.toLowerCase()).join(" ") || "";
  const ventaUsuario = (sale.usuario?.nombre || "").toLocaleLowerCase();
  const ventaCliente = (sale.clienteNombre || "").toLowerCase();

  return (
    ventaId.includes(searchLower) ||
    ventaDate.includes(searchLower) ||
    ventaTime.includes(searchLower) ||
    ventaProductos.includes(searchLower) ||
    ventaUsuario.includes(searchLower) ||
    ventaCliente.includes(searchLower)
  );
}

/**
 * The five facts that decide which empty state the sales history shows. All
 * five come from the SAME sales array in the SAME render.
 */
export interface SaleHistoryEmptyInput {
  /** Sales in the period, before any filter. */
  totalCount: number;
  /** Sales left after both filters — what the list actually renders. */
  visibleCount: number;
  /** The raw search term. NOT a derived "is the search on" boolean: see below. */
  searchTerm: string;
  /** Whether the sync-trace control is on. */
  syncTraceFilterActive: boolean;
  /** Whether the PERIOD holds at least one traced sale, ignoring the search. */
  anySaleWithSyncTrace: boolean;
}

/**
 * PURE. WHICH empty state the sales history shows, or null when it shows rows.
 *
 * It takes the raw searchTerm and not a caller-computed flag on purpose: "what
 * counts as an active search" is a definition, and a definition derived on both
 * sides of a call is a definition that can drift (E-014).
 *
 * PRECEDENCE, and it is the whole content of this function:
 *
 * 1. Rows on screen        -> null.
 * 2. An empty period       -> NO_SALES_IN_PERIOD, whatever the controls say.
 *    Nothing was filtered out, because there was nothing to filter.
 * 3. Trace filter on and the period holds no traced sale at all
 *                          -> NO_SALES_WITH_SYNC_TRACE, search term or not.
 *    This is the case the acceptance criteria name, and it stays the honest
 *    answer with a term typed: no wording about the term would help someone
 *    whose period has no traced sale to find.
 * 4. Trace filter on, traced sales exist, the term excluded them all
 *                          -> NO_TRACED_SALES_FOR_SEARCH.
 * 5. Trace filter off, the term excluded everything
 *                          -> NO_SALES_FOR_SEARCH.
 *
 * The two combinations left over — nothing visible with no control narrowing
 * anything — are unreachable WHEN the five inputs are read from one array in
 * one render, which is the only way this screen calls it: an empty term
 * matches every sale, and anySaleWithSyncTrace true means the trace filter
 * keeps at least one. Handed inconsistent numbers it returns null and the
 * screen shows an empty list with no message.
 *
 * Nothing here can throw on the declared input types: there is no throw
 * statement, and the only property read off a caller value is searchTerm's
 * length, on a required string. The residual branch returns null rather than
 * signalling, and that is deliberate: an exception raised during render takes
 * the whole /ventas screen down, which is far worse than a missing sentence.
 */
export function saleHistoryEmptyReason(
  input: SaleHistoryEmptyInput,
): ISaleHistoryEmptyReason | null {
  if (input.visibleCount > 0) return null;
  if (input.totalCount === 0) return "NO_SALES_IN_PERIOD";

  const searchActive = input.searchTerm.length > 0;

  if (input.syncTraceFilterActive && !input.anySaleWithSyncTrace) {
    return "NO_SALES_WITH_SYNC_TRACE";
  }
  if (input.syncTraceFilterActive && searchActive) {
    return "NO_TRACED_SALES_FOR_SEARCH";
  }
  if (searchActive) return "NO_SALES_FOR_SEARCH";
  return null;
}
