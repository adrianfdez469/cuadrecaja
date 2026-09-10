export interface IRefundSplit {
  /** Applied against the debt. Goes to MovimientoStock.montoAplicadoADeuda. */
  montoAplicadoADeuda: number;
  /** Actually handed back from the drawer. */
  montoEnEfectivo: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Non-finite and negative inputs are read as 0, so no field of the result is negative. */
function readAmount(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Splits a refund between the customer's outstanding debt and the cash drawer, DEBT
 * FIRST: the customer cannot be given cash back while still owing money for the same
 * sale.
 *
 *   splitRefundBetweenDebtAndCash(800, 500) -> { montoAplicadoADeuda: 500, montoEnEfectivo: 300 }
 *   splitRefundBetweenDebtAndCash(800, 0)   -> { montoAplicadoADeuda: 0,   montoEnEfectivo: 800 }
 *
 * The second case is today's behaviour for every non-credit sale, and it is what keeps
 * the refund path unchanged for a business that never sells on credit.
 *
 * Both inputs are read in base currency. A negative or non-finite input is read as 0, so
 * neither field of the result is ever negative. Both fields are rounded to two decimals,
 * and they add up to the rounded `montoReembolso`.
 */
export function splitRefundBetweenDebtAndCash(
  montoReembolso: number,
  saldoPendiente: number,
): IRefundSplit {
  const refund = readAmount(montoReembolso);
  const debt = readAmount(saldoPendiente);

  const roundedRefund = round2(refund);
  const applied = round2(Math.min(refund, debt));

  return {
    montoAplicadoADeuda: applied,
    montoEnEfectivo: round2(roundedRefund - applied),
  };
}
