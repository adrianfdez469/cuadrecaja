function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Non-finite input is read as 0, so no arithmetic here can produce a NaN. */
function readNumber(value: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface IAjusteBorradoInput {
  /** Venta.total before the deletion, base currency. */
  totalAnterior: number;
  /** Venta.creditoBase before the deletion. 0 for a sale with no credit. */
  creditoAnterior: number;
  /**
   * CuentaPorCobrar.saldoPendiente read UNDER THE ROW LOCK, or 0 when there is no account. It is
   * the third bound of the credit share, and what keeps applyMovimientoCuentaPorCobrar from
   * refusing with SALDO_INSUFICIENTE.
   */
  saldoPendiente: number;
  /**
   * The removed line's amount MINUS the discount it stops covering, base currency
   * (montoProductoBase - discountDelta, exactly as the route computes them today). It can be
   * negative when a shrinking discount pushes the total UP, and that case is preserved.
   */
  netoAjusteBase: number;
  totalcashAnterior: number;
  totaltransferAnterior: number;
}

export interface IAjusteBorradoReparto {
  /** New Venta.total. */
  nuevoTotal: number;
  /** New Venta.creditoBase. */
  nuevoCredito: number;
  /**
   * AJUSTE_DEVOLUCION amount for the ledger. When it is 0 the write door is NOT called:
   * decideMovimientoCuentaPorCobrar refuses MONTO_NO_POSITIVO.
   */
  ajusteCredito: number;
  /** What is left for the payment lines after the debt took its share. */
  remanenteBase: number;
  /** New Venta.totalcash. */
  nuevoTotalcash: number;
  /** New Venta.totaltransfer. */
  nuevoTotaltransfer: number;
}

/**
 * PURE. Splits the adjustment of a deleted sale line, DEBT FIRST: the debt absorbs as much of it
 * as it can, and only the remainder reaches the money already received.
 *
 * THE DENOMINATOR IS WHAT CHANGES. Today the route divides totalcash and totaltransfer by
 * `total`; with credit, `totalcash + totaltransfer` is not `total` — creditoBase is missing — so
 * the two ratios do not add up to 1 and totalcash comes out INFLATED. Here they are computed over
 * `total - creditoBase`: what was actually paid.
 *
 *   ajusteCredito      = neto > 0 ? min(neto, creditoAnterior, saldoPendiente) : 0
 *   remanenteBase      = neto - ajusteCredito
 *   nuevoCredito       = creditoAnterior - ajusteCredito
 *   pagadoAnterior     = totalAnterior - creditoAnterior
 *   ratioCash          = pagadoAnterior > 0 ? totalcashAnterior / pagadoAnterior : 0
 *   ratioTransfer      = pagadoAnterior > 0 ? totaltransferAnterior / pagadoAnterior : 0
 *   nuevoPagado        = max(0, pagadoAnterior - remanenteBase)
 *   nuevoTotalcash     = max(0, nuevoPagado * ratioCash)
 *   nuevoTotaltransfer = max(0, nuevoPagado * ratioTransfer)
 *   nuevoTotal         = max(0, totalAnterior - neto)
 *
 * Every field is rounded to two decimals.
 *
 * IT KEEPS THE SALE ADDING UP: nuevoTotalcash + nuevoTotaltransfer + nuevoCredito = nuevoTotal.
 *
 * WITH NO CREDIT IT IS TODAY'S ARITHMETIC, not an approximation of it: creditoAnterior = 0 makes
 * pagadoAnterior = totalAnterior, both ratios the current ones, remanenteBase = neto and
 * nuevoPagado = nuevoTotal, so the multiplication is the same one the route already performs.
 * That holds for a negative `neto` too.
 *
 * Worked, and it is criterion 8: totalAnterior 1000, creditoAnterior 400, saldoPendiente 400,
 * netoAjusteBase 300, totalcash 600, totaltransfer 0
 *   -> ajusteCredito 300, remanenteBase 0, nuevoCredito 100, nuevoTotalcash 600 (UNCHANGED),
 *      nuevoTotaltransfer 0, nuevoTotal 700.
 */
export function splitAjusteBorrado(
  input: IAjusteBorradoInput,
): IAjusteBorradoReparto {
  const totalAnterior = readNumber(input?.totalAnterior);
  const creditoAnterior = readNumber(input?.creditoAnterior);
  const saldoPendiente = readNumber(input?.saldoPendiente);
  const neto = readNumber(input?.netoAjusteBase);
  const totalcashAnterior = readNumber(input?.totalcashAnterior);
  const totaltransferAnterior = readNumber(input?.totaltransferAnterior);

  const ajusteCredito =
    neto > 0 ? Math.min(neto, creditoAnterior, saldoPendiente) : 0;
  const remanenteBase = neto - ajusteCredito;
  const nuevoCredito = creditoAnterior - ajusteCredito;

  const pagadoAnterior = totalAnterior - creditoAnterior;
  const ratioCash =
    pagadoAnterior > 0 ? totalcashAnterior / pagadoAnterior : 0;
  const ratioTransfer =
    pagadoAnterior > 0 ? totaltransferAnterior / pagadoAnterior : 0;

  const nuevoPagado = Math.max(0, pagadoAnterior - remanenteBase);

  return {
    nuevoTotal: round2(Math.max(0, totalAnterior - neto)),
    nuevoCredito: round2(nuevoCredito),
    ajusteCredito: round2(ajusteCredito),
    remanenteBase: round2(remanenteBase),
    nuevoTotalcash: round2(Math.max(0, nuevoPagado * ratioCash)),
    nuevoTotaltransfer: round2(Math.max(0, nuevoPagado * ratioTransfer)),
  };
}
