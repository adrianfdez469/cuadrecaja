import {
  AGING_BUCKETS,
  bucketAntiguedad,
  daysOutstanding,
  MIN_OPEN_BALANCE_BASE,
  type IAgingBucket,
} from "@/lib/cuentasPorCobrar/aging";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";
import type {
  IDeudorRow,
  IMovimientoCuentaPorCobrarConAutor,
} from "@/schemas/cuentasPorCobrarPanel";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** One live account as it comes out of the query, before anything is derived from it. */
export interface ICuentaPanelInput {
  id: string;
  ventaId: string;
  clienteId: string;
  tiendaId: string;
  tiendaNombre: string;
  fechaVenta: Date;
  montoOriginal: number;
  /** The denormalized column, read as it is. The ledger is not walked here (ADR 0126). */
  saldoPendiente: number;
  settledAt: Date | null;
  monedaDeudaCode: string | null;
  montoDeudaMonedaOriginal: number | null;
}

export interface ICuentaPanelRow extends ICuentaPanelInput {
  /** daysOutstanding(fechaVenta, at). */
  dias: number;
  bucket: IAgingBucket;
}

/**
 * PURE. Attaches `dias` and `bucket` to each account, measured against `at`.
 *
 * `at` is the ONLY clock this module reads: nothing here calls Date.now(). The caller computes it
 * once per request and echoes it in the response, so two rows of the same answer can never land
 * in different brackets and the classification is reproducible (dosier § 7).
 */
export function withAging(
  cuentas: ICuentaPanelInput[],
  at: Date,
): ICuentaPanelRow[] {
  const input = Array.isArray(cuentas) ? cuentas : [];
  const rows: ICuentaPanelRow[] = [];

  for (const cuenta of input) {
    if (!cuenta) continue;
    const dias = daysOutstanding(cuenta.fechaVenta, at);
    rows.push({ ...cuenta, dias, bucket: bucketAntiguedad(dias) });
  }

  return rows;
}

/**
 * PURE. Keeps the accounts whose bracket equals `bucket`. A null `bucket` keeps them all.
 *
 * Classification goes through `bucketAntiguedad`, which `src/lib/cuentasPorCobrar/aging.ts`
 * declares the only interpreter of AGING_BUCKETS: the cut is NOT rewritten as a date range
 * (E-014, ADR 0126).
 *
 * Worked, with `at` fixed and three accounts aged 30, 45 and 61 days: filtering by "31-60" keeps
 * only the one aged 45. The one aged 30 lands in "0-30" (30 <= 30) and the one aged 61 in
 * "61-90" (61 <= 90).
 */
export function filterByBucket(
  cuentas: ICuentaPanelRow[],
  bucket: IAgingBucket | null,
): ICuentaPanelRow[] {
  const input = Array.isArray(cuentas) ? cuentas : [];
  if (!bucket) return [...input];
  return input.filter((cuenta) => cuenta && cuenta.bucket === bucket);
}

export const DEUDOR_ESTADOS_INTERNAL = ["CON_DEUDA", "SALDADA"] as const;

export interface IDeudorInput {
  clienteId: string;
  clienteNombre: string;
  telefono: string | null;
  /** The cliente's LIVE accounts, already aged and already filtered. May be empty. */
  cuentas: ICuentaPanelRow[];
  /** `fecha` of its most recent ABONO, or null. */
  ultimoAbonoAt: Date | null;
  /** The open CierrePeriodo of each store, by tiendaId. Absent means the till is closed. */
  cierrePeriodoAbiertoPorTienda?: Record<string, string>;
}

/**
 * PURE. One row per deudor.
 *
 * `saldo` sums only the accounts whose saldoPendiente is ABOVE MIN_OPEN_BALANCE_BASE — the same
 * threshold `buildCuentasPorCobrarSnapshot` uses to drop an account, so a cent left by rounding
 * is not an open debt in one place and is in the other.
 *
 * `estado` is "CON_DEUDA" when at least one account survives that threshold, and "SALDADA"
 * otherwise. There are two values and only two: this product has no notion of an overdue debt —
 * a debt is either settled or written off (progress, Q1). What criterion 1 calls "lo vencido" is
 * the AGING column: `antiguedadDias` and `antiguedadBucket`, the highest among the accounts.
 *
 * `ultimoAbonoAt` counts ABONO rows only. A reverted ABONO still counts: the ledger is
 * append-only and the payment did happen.
 *
 * Sorted by `saldo` descending, ties broken by `clienteNombre` ascending, so the order is
 * deterministic and a page boundary cannot show the same row twice.
 */
export function buildDeudorRows(deudores: IDeudorInput[]): IDeudorRow[] {
  const input = Array.isArray(deudores) ? deudores : [];
  const rows: IDeudorRow[] = [];

  for (const deudor of input) {
    if (!deudor) continue;
    const cuentas = Array.isArray(deudor.cuentas) ? deudor.cuentas : [];
    const abiertas = cuentas.filter(
      (cuenta) => cuenta && cuenta.saldoPendiente > MIN_OPEN_BALANCE_BASE,
    );

    const saldo = round2(
      abiertas.reduce((sum, cuenta) => sum + cuenta.saldoPendiente, 0),
    );

    let antiguedadDias: number | null = null;
    for (const cuenta of abiertas) {
      if (antiguedadDias === null || cuenta.dias > antiguedadDias) {
        antiguedadDias = cuenta.dias;
      }
    }

    const periodos = deudor.cierrePeriodoAbiertoPorTienda ?? {};

    rows.push({
      clienteId: deudor.clienteId,
      clienteNombre: deudor.clienteNombre,
      telefono: deudor.telefono ?? null,
      saldo,
      cuentasAbiertas: abiertas.length,
      antiguedadDias,
      antiguedadBucket:
        antiguedadDias === null ? null : bucketAntiguedad(antiguedadDias),
      ultimoAbonoAt: deudor.ultimoAbonoAt ?? null,
      estado: abiertas.length > 0 ? "CON_DEUDA" : "SALDADA",
      cuentas: cuentas.map((cuenta) => ({
        id: cuenta.id,
        ventaId: cuenta.ventaId,
        tiendaId: cuenta.tiendaId,
        tiendaNombre: cuenta.tiendaNombre,
        fechaVenta: cuenta.fechaVenta,
        montoOriginal: cuenta.montoOriginal,
        saldoPendiente: cuenta.saldoPendiente,
        settledAt: cuenta.settledAt ?? null,
        monedaDeudaCode: cuenta.monedaDeudaCode ?? null,
        montoDeudaMonedaOriginal: cuenta.montoDeudaMonedaOriginal ?? null,
        dias: cuenta.dias,
        bucket: cuenta.bucket,
        cierrePeriodoAbiertoId: periodos[cuenta.tiendaId] ?? null,
      })),
    });
  }

  rows.sort((a, b) => {
    if (b.saldo !== a.saldo) return b.saldo - a.saldo;
    return a.clienteNombre.localeCompare(b.clienteNombre);
  });

  return rows;
}

/* ------------------------------------------------ what the screen derives */

/**
 * The options of the aging filter, DERIVED from AGING_BUCKETS and never rewritten (E-014).
 * With today's brackets: `0-30 días`, `31-60 días`, `61-90 días`, `91+ días`.
 */
export const AGING_BUCKET_OPTIONS: ReadonlyArray<{
  value: IAgingBucket;
  label: string;
}> = AGING_BUCKETS.map((bucket) => ({
  value: bucket.bucket,
  label: `${bucket.bucket} días`,
}));

/**
 * PURE. How a number of days reads in the panel.
 *
 * A zero or negative figure reads "Hoy": `daysOutstanding` returns a negative number for a sale
 * dated in the future, and "-1 días" is not a thing anybody says.
 */
export function formatAntiguedadDias(dias: number): string {
  const value = Number(dias) || 0;
  if (value <= 0) return "Hoy";
  if (value === 1) return "1 día";
  return `${value} días`;
}

/**
 * PURE. Sum of the `equivalenteBase` of the payment lines, rounded to two decimals — the same
 * rounding `valueAbonoPagos` applies on the server. Without it, floating point would make the
 * screen say "supera el saldo" by 0.0000001 where the server accepts.
 */
export function sumEquivalenteBase(pagos: IPagoLinea[]): number {
  const lineas = Array.isArray(pagos) ? pagos : [];
  return round2(
    lineas.reduce((sum, linea) => sum + (Number(linea?.equivalenteBase) || 0), 0),
  );
}

export const ABONO_OUTCOMES = ["VACIO", "PARCIAL", "SALDA", "EXCEDE"] as const;
export type IAbonoOutcomeEstado = (typeof ABONO_OUTCOMES)[number];

export interface IAbonoOutcome {
  estado: IAbonoOutcomeEstado;
  /** What the debtor will still owe. 0 for every outcome that is not PARCIAL. */
  restante: number;
  /** How much the collection goes over the balance. 0 for every outcome that is not EXCEDE. */
  exceso: number;
}

/**
 * PURE. What the collection dialog says before it is confirmed.
 *
 * The EXCEDE rule is guard 8 of the server's decider, letter for letter, reading the same
 * MIN_OPEN_BALANCE_BASE of `src/lib/cuentasPorCobrar/aging.ts`. The threshold is not paraphrased
 * (E-039): if the two diverged, the screen would block collections the server accepts, or the
 * other way round.
 */
export function describeAbono(
  saldoPendiente: number,
  montoBase: number,
): IAbonoOutcome {
  const saldo = Number(saldoPendiente) || 0;
  const monto = Number(montoBase) || 0;

  if (!(monto > 0)) return { estado: "VACIO", restante: 0, exceso: 0 };
  if (monto > saldo + MIN_OPEN_BALANCE_BASE) {
    return { estado: "EXCEDE", restante: 0, exceso: round2(monto - saldo) };
  }
  if (saldo - monto <= MIN_OPEN_BALANCE_BASE) {
    return { estado: "SALDA", restante: 0, exceso: 0 };
  }
  return { estado: "PARCIAL", restante: round2(saldo - monto), exceso: 0 };
}

/** The minimum a ledger row needs to be flattened into the book. */
export interface ICuentaConMovimientos {
  id: string;
  fechaVenta: Date;
  tiendaNombre: string;
  movimientos: IMovimientoCuentaPorCobrarConAutor[];
}

export interface IMovimientoRow {
  id: string;
  cuentaId: string;
  tipo: ITipoMovimientoCuentaPorCobrar;
  monto: number;
  fecha: Date;
  motivo: string | null;
  revierteId: string | null;
  /** The `fechaVenta` of the account this row belongs to. */
  ventaFecha: Date;
  tiendaNombre: string;
  /** Whether a REVERSION_ABONO OF THE SAME ACCOUNT points at this row. */
  revertido: boolean;
  esReversion: boolean;
  /**
   * Who registered it, or null. Projected by the two detail endpoints (contract § 5.6); it is
   * carried on the row so the book can name the author beside the action, which is what
   * criterion 52 of the design measures.
   */
  usuarioNombre: string | null;
}

/**
 * PURE. Flattens the ledger of every account of a debtor into one list, newest first, ties
 * broken by `id` ascending so the order is deterministic.
 *
 * `revertido` only looks INSIDE the same account: a reversal can never point at another
 * account's ABONO (the write door refuses it), so a same-amount ABONO of a different account
 * must not be marked.
 */
export function buildMovimientoRows(
  cuentas: ICuentaConMovimientos[],
): IMovimientoRow[] {
  const input = Array.isArray(cuentas) ? cuentas : [];
  const rows: IMovimientoRow[] = [];

  for (const cuenta of input) {
    if (!cuenta) continue;
    const movimientos = Array.isArray(cuenta.movimientos)
      ? cuenta.movimientos
      : [];

    const revertidos = new Set<string>();
    for (const movimiento of movimientos) {
      if (!movimiento) continue;
      if (movimiento.tipo === "REVERSION_ABONO" && movimiento.revierteId) {
        revertidos.add(movimiento.revierteId);
      }
    }

    for (const movimiento of movimientos) {
      if (!movimiento) continue;
      rows.push({
        id: movimiento.id,
        cuentaId: cuenta.id,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        fecha: movimiento.fecha,
        motivo: movimiento.motivo ?? null,
        revierteId: movimiento.revierteId ?? null,
        ventaFecha: cuenta.fechaVenta,
        tiendaNombre: cuenta.tiendaNombre,
        revertido: revertidos.has(movimiento.id),
        esReversion: movimiento.tipo === "REVERSION_ABONO",
        usuarioNombre: movimiento.usuarioNombre ?? null,
      });
    }
  }

  rows.sort((a, b) => {
    const diff = b.fecha.getTime() - a.fecha.getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return rows;
}

export interface IFiltroOpcion {
  id: string;
  nombre: string;
}

export interface IFiltroOpciones {
  deudores: IFiltroOpcion[];
  tiendas: IFiltroOpcion[];
}

/**
 * PURE. The options of the `Deudor` and `Tienda` filters, derived from the universe of rows the
 * server answered with — never from `user.locales`, which can be narrower than what the panel
 * shows (the panel is scoped by negocio, not by the stores assigned to the user).
 */
export function buildFiltroOpciones(deudores: IDeudorRow[]): IFiltroOpciones {
  const input = Array.isArray(deudores) ? deudores : [];
  const tiendas = new Map<string, string>();
  const clientes: IFiltroOpcion[] = [];

  for (const deudor of input) {
    if (!deudor) continue;
    clientes.push({ id: deudor.clienteId, nombre: deudor.clienteNombre });
    for (const cuenta of deudor.cuentas ?? []) {
      if (!cuenta) continue;
      if (!tiendas.has(cuenta.tiendaId)) {
        tiendas.set(cuenta.tiendaId, cuenta.tiendaNombre);
      }
    }
  }

  clientes.sort((a, b) => a.nombre.localeCompare(b.nombre));

  return {
    deudores: clientes,
    tiendas: [...tiendas.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  };
}
