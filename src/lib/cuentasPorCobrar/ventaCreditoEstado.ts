import { MIN_OPEN_BALANCE_BASE } from "@/lib/cuentasPorCobrar/aging";
import { MOVIMIENTO_CUENTA_POR_COBRAR_SIGN } from "@/lib/cuentasPorCobrar/saldo";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The three states a sale can be in with respect to credit. ONE declaration, read by the list
 * row, by the mobile card and by the detail dialog — a derived signal whose definition gets
 * paraphrased in three places is E-014.
 *
 * SALDADA is spelled exactly as in DEUDOR_ESTADOS (src/schemas/cuentasPorCobrarPanel.ts): the
 * same word for the same fact.
 */
export const VENTA_CREDITO_ESTADOS = [
  "SIN_CREDITO",
  "CON_SALDO",
  "SALDADA",
] as const;

export type IVentaCreditoEstado = (typeof VENTA_CREDITO_ESTADOS)[number];

/**
 * The minimum the resolver reads. STRUCTURAL on purpose, so this module does not import the
 * schema module that imports it back (E-028), and so a `Sale` of the POS store satisfies it as
 * well as an `IVenta`.
 */
export interface IVentaCreditoEstadoInput {
  creditoBase?: number | null;
  credito?: {
    saldoPendiente: number;
    /**
     * Compared against null ONLY: over the wire it is a string (E-074).
     *
     * OPTIONAL rather than required, which is the one widening this interface takes over the
     * contract's § 4.1: with `strict: false`, `z.coerce.date().nullable()` infers the key as
     * OPTIONAL, so an `IVenta.credito` does not satisfy a required `settledAt` and none of the
     * five call sites would compile. Absent and `null` are read the same way — a live account.
     */
    settledAt?: Date | string | null;
  } | null;
}

/**
 * PURE. The credit state of a sale, read from EXPLICIT fields.
 *
 *   creditoBase <= 0                      -> SIN_CREDITO
 *   no credito block                      -> CON_SALDO
 *   settledAt is set                      -> SALDADA
 *   saldoPendiente > MIN_OPEN_BALANCE_BASE -> CON_SALDO, else SALDADA
 *
 * It NEVER compares totalcash + totaltransfer against total: a cash sale whose payment lines
 * round to 9.99 on a total of 10.00 would be marked as credit by that deduction and is not
 * (E-013, criterion 2).
 *
 * "A credit sale whose block did not travel" is read as CON_SALDO: a sale still queued offline
 * has no account yet, and calling it settled would be the one wrong answer.
 *
 * MIN_OPEN_BALANCE_BASE is IMPORTED from src/lib/cuentasPorCobrar/aging.ts, the only definition
 * of the threshold.
 */
export function resolveVentaCreditoEstado(
  venta: IVentaCreditoEstadoInput,
): IVentaCreditoEstado {
  const creditoBase = Number(venta?.creditoBase ?? 0) || 0;
  if (!(creditoBase > 0)) return "SIN_CREDITO";

  const credito = venta?.credito ?? null;
  if (credito === null) return "CON_SALDO";

  // Compared with `!= null`, which covers the null, the undefined and the absent key at once
  // (§ 0.6 (d)): with `strict: false` a `.nullable()` of zod is inferred as an OPTIONAL key. No
  // `Date` method is ever called on it — over the wire this field is a string (E-074).
  if (credito.settledAt != null) {
    return "SALDADA";
  }

  const saldo = Number(credito.saldoPendiente ?? 0) || 0;
  return saldo > MIN_OPEN_BALANCE_BASE ? "CON_SALDO" : "SALDADA";
}

/** The minimum a ledger row needs for the summary. Same figure as ICuentaPorCobrarMovimientoSaldo. */
export interface IVentaCobroRow {
  tipo: ITipoMovimientoCuentaPorCobrar;
  /** Positive, in base currency. */
  monto: number;
}

export interface IVentaCobrosResumen {
  /** ABONO rows minus REVERSION_ABONO rows, floored at 0. */
  cobros: number;
  /** Those same collections in base currency, rounded to two decimals and floored at 0. */
  cobrosMontoBase: number;
  /** Rows of ANY tipo. */
  movimientos: number;
}

/** The two types that move physical money, and therefore the only ones the summary counts. */
const TIPOS_CON_DINERO: ITipoMovimientoCuentaPorCobrar[] = [
  "ABONO",
  "REVERSION_ABONO",
];

/**
 * PURE. How much money this debt has actually taken in, and how many times.
 *
 * The SIGN is not restated here: money received is the OPPOSITE of the effect the movement has on
 * the balance, so the amount is accumulated as
 * `-MOVIMIENTO_CUENTA_POR_COBRAR_SIGN[tipo] * monto` over ABONO and REVERSION_ABONO only. That map
 * (src/lib/cuentasPorCobrar/saldo.ts) is the only definition of the sign and is imported, not
 * copied (E-039). CONDONACION and AJUSTE_DEVOLUCION move no physical money and contribute only to
 * `movimientos`.
 *
 * It is NOT netCollectionRows (src/lib/cuentasPorCobrar/cobrosNetos.ts) and does not replace it:
 * that one answers what the CASH ENGINES add up, per currency and per payment line. This one
 * answers "has this sale been paid against, and by how much in base currency", which is what a
 * refusal message and a delete gate need.
 *
 * THE CALLER PASSES THE ACCOUNT'S WHOLE LEDGER.
 *
 * BOTH `cobros` AND `cobrosMontoBase` ARE FLOORED AT 0, and the two floors are one decision, not
 * two. A REVERSION_ABONO whose ABONO is not in the array nets to a negative count and a negative
 * amount, and the amount is the one that reaches a human: criterion 6 requires the 409 to name how
 * many collections and for how much, and "2 cobros por -300,00 CUP" is not a message, it is a bug
 * on screen.
 *
 * Flooring loses nothing, because the floored case is UNREACHABLE THROUGH THE WRITE DOOR: guard 4
 * of decideMovimientoCuentaPorCobrar refuses a REVERSION_ABONO whose origin is not in the same
 * account (REVERSION_ORIGEN_INALCANZABLE), so a whole ledger always carries the collection a
 * reversal undoes. What is left is a filtered subset or a row written around the door.
 *
 * AND THE SAFE OUTCOME IS BY CONSTRUCTION, not by luck: with both figures at 0 and `movimientos`
 * still positive, the delete gate falls through to CREDITO_CON_MOVIMIENTOS, whose text carries no
 * figures at all. The sale stays blocked and the absurd message cannot be built.
 *
 * A reversal that DOES have its collection nets normally and is not floored: ABONO 200 plus
 * ABONO 300 plus REVERSION_ABONO 300 is 1 collection worth 200. THE FLOOR IS ON THE AGGREGATE,
 * never on each row.
 */
export function summarizeVentaCobros(
  movimientos: IVentaCobroRow[],
): IVentaCobrosResumen {
  const rows = Array.isArray(movimientos) ? movimientos : [];

  let cobros = 0;
  let cobrosMontoBase = 0;

  for (const row of rows) {
    if (!row) continue;
    if (!TIPOS_CON_DINERO.includes(row.tipo)) continue;
    const sign = MOVIMIENTO_CUENTA_POR_COBRAR_SIGN[row.tipo];
    if (sign === undefined) continue;
    // Money received is the opposite of what the movement does to the balance.
    cobros += -sign;
    cobrosMontoBase += -sign * (Number(row.monto) || 0);
  }

  return {
    cobros: Math.max(0, cobros),
    cobrosMontoBase: Math.max(0, round2(cobrosMontoBase)),
    movimientos: rows.filter((row) => !!row).length,
  };
}
