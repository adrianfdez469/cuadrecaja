import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";

/**
 * The sign each movement type applies to the balance. THE ONLY definition of this rule.
 *
 * ABONO, AJUSTE_DEVOLUCION and CONDONACION lower the balance; REVERSION_ABONO raises it,
 * because it undoes an ABONO that had lowered it. `Record<ITipoMovimientoCuentaPorCobrar, …>`
 * on purpose: a fifth movement type does not compile until its sign is decided here.
 */
export const MOVIMIENTO_CUENTA_POR_COBRAR_SIGN: Record<
  ITipoMovimientoCuentaPorCobrar,
  1 | -1
> = {
  ABONO: -1,
  AJUSTE_DEVOLUCION: -1,
  CONDONACION: -1,
  REVERSION_ABONO: 1,
};

/** The minimum a movement needs for computeSaldoAlCierre to read it. */
export interface ICuentaPorCobrarMovimientoSaldo {
  tipo: ITipoMovimientoCuentaPorCobrar;
  /** Positive, in base currency. */
  monto: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Balance of an account, in base currency: montoOriginal plus the signed sum of its
 * movements, rounded to two decimals.
 *
 * It does NOT filter by date. The cutoff is the caller's `where`
 * (`movimientos: { where: { fecha: { lte: corte } } }`), which is why the parameter is
 * named `movementsUpToCutoff`: what arrives here is already the set the period is being
 * computed against. The `AlCierre` of the name refers to that cutoff, not to a filter
 * this function performs.
 *
 * A negative result is returned as it is, not clamped to zero: an over-collected account
 * is an anomaly the caller has to be able to see.
 */
export function computeSaldoAlCierre(
  montoOriginal: number,
  movementsUpToCutoff: ICuentaPorCobrarMovimientoSaldo[],
): number {
  const base = Number(montoOriginal) || 0;
  const movements = Array.isArray(movementsUpToCutoff)
    ? movementsUpToCutoff
    : [];

  const signed = movements.reduce((sum, movement) => {
    if (!movement) return sum;
    const sign = MOVIMIENTO_CUENTA_POR_COBRAR_SIGN[movement.tipo];
    // A tipo outside the sign map is only reachable if a caller forces the type: it
    // contributes nothing rather than throwing.
    if (sign === undefined) return sum;
    return sum + sign * (Number(movement.monto) || 0);
  }, 0);

  return round2(base + signed);
}
