import { computeSaldoAlCierre } from "@/lib/cuentasPorCobrar/saldo";
import type { ICuentaPorCobrarMovimientoSaldo } from "@/lib/cuentasPorCobrar/saldo";

/**
 * The aging brackets, in order, with the UPPER bound of each one in days. THE ONLY
 * definition of the brackets in the project (E-014): `bucketAntiguedad` is its only
 * interpreter, and every screen, report and closing figure that shows aging reads the
 * bucket this function returns instead of restating the numbers.
 *
 * `null` on the last one means "no upper bound".
 */
export const AGING_BUCKETS = [
  { bucket: "0-30", maxDays: 30 },
  { bucket: "31-60", maxDays: 60 },
  { bucket: "61-90", maxDays: 90 },
  { bucket: "91+", maxDays: null },
] as const;

export type IAgingBucket = (typeof AGING_BUCKETS)[number]["bucket"];

/** Milliseconds in a day. */
const MS_PER_DAY = 86_400_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Whole days elapsed between `fechaVenta` and `at`, floored. Negative when `fechaVenta`
 * is later than `at` (a sale dated in the future), and that negative value is returned,
 * not clamped: `bucketAntiguedad` is what decides where it lands.
 */
export function daysOutstanding(fechaVenta: Date, at: Date): number {
  return Math.floor((at.getTime() - fechaVenta.getTime()) / MS_PER_DAY);
}

/**
 * Classifies a number of DAYS into its bracket. Takes days, not dates, so the boundary
 * cases of criterion 8 are exactly eight numbers.
 *
 * The first bracket whose `maxDays` is not exceeded wins:
 *
 *   dias <= 30  -> "0-30"    (this is where 0 lands, and any negative one: a sale dated
 *                             in the future has not aged at all)
 *   dias <= 60  -> "31-60"
 *   dias <= 90  -> "61-90"
 *   otherwise   -> "91+"
 */
export function bucketAntiguedad(dias: number): IAgingBucket {
  for (const entry of AGING_BUCKETS) {
    if (entry.maxDays === null || dias <= entry.maxDays) return entry.bucket;
  }
  return AGING_BUCKETS[AGING_BUCKETS.length - 1].bucket;
}

/**
 * A balance at or below this, in base currency, is not an open account: it is the cent
 * left over by rounding.
 *
 * Numerically equal to SALE_TOTAL_TOLERANCE_BASE and deliberately NOT the same constant:
 * that one is the gap tolerated between a client's total and the server's, and the two
 * can be tuned for different reasons.
 */
export const MIN_OPEN_BALANCE_BASE = 0.01;

export interface ICuentaPorCobrarSnapshotInput {
  id: string;
  clienteId: string;
  clienteNombre?: string | null;
  fechaVenta: Date;
  montoOriginal: number;
  /** Already filtered by the caller's cutoff, same as computeSaldoAlCierre expects. */
  movimientos: ICuentaPorCobrarMovimientoSaldo[];
}

export interface ICuentaPorCobrarSnapshotRow {
  id: string;
  clienteId: string;
  clienteNombre: string | null;
  fechaVenta: Date;
  montoOriginal: number;
  /** computeSaldoAlCierre over `movimientos`. Greater than MIN_OPEN_BALANCE_BASE. */
  saldo: number;
  /** daysOutstanding(fechaVenta, at). */
  dias: number;
  bucket: IAgingBucket;
}

export interface ICuentasPorCobrarSnapshot {
  /** The instant the whole snapshot was measured against — the `at` it received. */
  at: Date;
  /** Sum of `saldo` over `cuentas`, rounded to two decimals. */
  total: number;
  /** Sum of `saldo` per bracket. All four keys are present; an empty bracket is 0. */
  porBucket: Record<IAgingBucket, number>;
  /** Sorted by `fechaVenta` ascending. */
  cuentas: ICuentaPorCobrarSnapshotRow[];
}

function emptyBuckets(): Record<IAgingBucket, number> {
  return AGING_BUCKETS.reduce(
    (acc, entry) => {
      acc[entry.bucket] = 0;
      return acc;
    },
    {} as Record<IAgingBucket, number>,
  );
}

/**
 * Aging snapshot of a set of accounts, measured against `at`.
 *
 * `at` is the ONLY clock this function reads: it never calls Date.now(). That is what
 * makes recomputing an old closing give the same aging every time it runs, and it is
 * exactly criterion 6 — two calls with the same `at`, made at different moments, return
 * the same `dias`.
 *
 * Accounts whose balance is at or below MIN_OPEN_BALANCE_BASE are dropped: they do not
 * appear in `cuentas`, do not add to `total` and do not add to `porBucket`.
 */
export function buildCuentasPorCobrarSnapshot(
  cuentas: ICuentaPorCobrarSnapshotInput[],
  at: Date,
): ICuentasPorCobrarSnapshot {
  const porBucket = emptyBuckets();
  const rows: ICuentaPorCobrarSnapshotRow[] = [];
  const input = Array.isArray(cuentas) ? cuentas : [];

  for (const cuenta of input) {
    if (!cuenta) continue;
    const saldo = computeSaldoAlCierre(
      cuenta.montoOriginal,
      cuenta.movimientos ?? [],
    );
    if (!(saldo > MIN_OPEN_BALANCE_BASE)) continue;

    const dias = daysOutstanding(cuenta.fechaVenta, at);
    const bucket = bucketAntiguedad(dias);
    porBucket[bucket] = round2(porBucket[bucket] + saldo);

    rows.push({
      id: cuenta.id,
      clienteId: cuenta.clienteId,
      clienteNombre: cuenta.clienteNombre ?? null,
      fechaVenta: cuenta.fechaVenta,
      montoOriginal: cuenta.montoOriginal,
      saldo,
      dias,
      bucket,
    });
  }

  rows.sort((a, b) => a.fechaVenta.getTime() - b.fechaVenta.getTime());

  const total = round2(rows.reduce((sum, row) => sum + row.saldo, 0));

  return { at, total, porBucket, cuentas: rows };
}
