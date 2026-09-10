import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * A collection row as the two cash engines read it after the query widened to include
 * REVERSION_ABONO. It is structurally what `CierreAbono` (src/lib/cierre/computeCierreTotals.ts)
 * and `buildResumenMonedas` (src/lib/movimiento/caja.ts) already ask for, so neither of them
 * changes a line.
 */
export interface ICobroNetoRow {
  id: string;
  fecha: Date;
  tasaSnapshot: ITasaSnapshot | null;
  pagosDetalle: IPagoLinea[] | null;
}

/** One row as it comes out of the widened query, with its reversed movement joined in. */
export interface ICobroRowInput {
  id: string;
  tipo: "ABONO" | "REVERSION_ABONO";
  fecha: Date;
  tasaSnapshot: ITasaSnapshot | null;
  pagosDetalle: IPagoLinea[] | null;
  /** The ABONO this row reverses, from `revierte: { select: { pagosDetalle, tasaSnapshot } }`. */
  revierte?: {
    pagosDetalle: IPagoLinea[] | null;
    tasaSnapshot: ITasaSnapshot | null;
  } | null;
}

/**
 * PURE. Turns the rows of a period into the rows the cash engines add up, applying the SIGN of a
 * reversal.
 *
 *   ABONO            -> passes through unchanged.
 *   REVERSION_ABONO  -> is replaced by a MIRROR: the payment lines of the ABONO it reverses, with
 *                       `monto` and `equivalenteBase` NEGATED, the tasaSnapshot OF THE ORIGIN, and
 *                       the `fecha` OF THE REVERSAL.
 *   A reversal whose origin did not come in the join contributes nothing.
 *
 * WHY A MIRROR AND NOT A WIDER FILTER. `buildResumenMonedas` and `valueAbonos` only ADD: both walk
 * `pagosDetalle` and accumulate `convertToBase(linea.monto, ...)`. Feeding them a reversal with the
 * origin's lines as they are would count the money TWICE instead of cancelling it. Negating the
 * amounts is what makes both of them subtract, in `totalEfectivo`, in `totalTransfer`, in
 * `equivalenteBase` and in `transferBaseByDestination`, with no change to either function.
 *
 * WHY THE ORIGIN'S SNAPSHOT. `valueAbonos` resolves rates with
 * `resolveSnapshotFromHistory(history, row.tasaSnapshot, row.fecha)`, where the row's own snapshot
 * takes precedence. Carrying the origin's snapshot is what makes the collection and its mirror be
 * valued with the SAME rates even when the reversal happens weeks later, so the cancellation is
 * exact rather than approximate.
 *
 * THESE ROWS ARE NEVER PERSISTED. A negative `monto` does not satisfy `pagoLineaSchema`
 * (`.positive()`), which is exactly why the sign is applied on the read side (ADR 0120, amended).
 *
 * Worked, and verified by running it: an ABONO of 100 USD cash at 120 plus 500 CUP by transfer is
 * worth 12500 in base; its mirror is worth -12500; the two together net to 0.
 */
export function netCollectionRows(rows: ICobroRowInput[]): ICobroNetoRow[] {
  const input = Array.isArray(rows) ? rows : [];
  const netos: ICobroNetoRow[] = [];

  for (const row of input) {
    if (!row) continue;

    if (row.tipo !== "REVERSION_ABONO") {
      netos.push({
        id: row.id,
        fecha: row.fecha,
        tasaSnapshot: row.tasaSnapshot ?? null,
        pagosDetalle: row.pagosDetalle ?? null,
      });
      continue;
    }

    const origen = row.revierte;
    // A reversal whose origin did not travel in the join contributes nothing: guessing its
    // composition would be inventing money, in either direction.
    if (!origen || !Array.isArray(origen.pagosDetalle)) continue;

    netos.push({
      id: row.id,
      fecha: row.fecha,
      tasaSnapshot: origen.tasaSnapshot ?? null,
      pagosDetalle: origen.pagosDetalle.map((linea) => ({
        ...linea,
        monto: -(Number(linea?.monto) || 0),
        equivalenteBase: -(Number(linea?.equivalenteBase) || 0),
      })),
    });
  }

  return netos;
}
