/**
 * The checkout's credit arithmetic. A plain `.ts` next to `paymentMath.ts` and `tipMath.ts`,
 * which is where this project already keeps the checkout's arithmetic.
 *
 * ALL the decidable logic of the dossier's bugs 1 and 2 lives here, because `handleMakePay`
 * is in a `.tsx` and no symbol of a `.tsx` is importable from a test (E-015).
 */

/** Rounds to two decimals, the way the rest of the checkout does. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The customer a credit sale is going to hang from, as the checkout knows it. */
export interface ICreditSelection {
  /** null when the cashier typed a name that has no row yet (offline). */
  clienteId: string | null;
  /** Always present: it is what the ticket prints and what the server resolves offline. */
  clienteNombre: string;
}

/** The three keys a credit sale adds to the multimoneda payload. Empty when there is none. */
export interface ICreditSaleExtras {
  creditoBase?: number;
  clienteId?: string;
  clienteNombre?: string;
}

/**
 * The debt a sale leaves: what the payment does not cover, in base currency.
 *
 * THE ONLY definition of the amount, and the reason change and credit cannot both happen:
 * this is zero exactly when `paid >= amountDue`, which is exactly when there is change. No
 * "credit with change" branch exists to be written or tested (E-032).
 *
 * `amountDue` is the figure the checkout measures the payment against, tip included. With
 * credit active the tip is always zero, so it is the sale's total.
 */
export function creditoBaseFor(
  selection: ICreditSelection | null,
  amountDue: number,
  paid: number,
): number {
  if (!selection) return 0;
  return round2(Math.max(0, amountDue - paid));
}

/**
 * The credit keys of the payload, or an empty object.
 *
 * It returns NOTHING when `creditoBase` is not above zero, even with a customer selected:
 * a sale the customer ended up covering in full is an ordinary sale, and its payload has to
 * be indistinguishable from one that never touched the credit row.
 */
export function buildCreditExtras(
  selection: ICreditSelection | null,
  creditoBase: number,
): ICreditSaleExtras {
  if (!selection || !(creditoBase > 0)) return {};
  return {
    creditoBase,
    // `clienteId` is omitted rather than sent as null: multimonedaExtrasSchema.clienteId is
    // a uuid() and a null does not satisfy it.
    ...(selection.clienteId ? { clienteId: selection.clienteId } : {}),
    ...(selection.clienteNombre
      ? { clienteNombre: selection.clienteNombre }
      : {}),
  };
}

/**
 * Whether what is on the table covers the sale. Bug 1 of the dossier: the comparison used
 * to leave the credit out, so a credit sale was always short and was dropped with a message
 * blaming the cashier.
 *
 * Compared in cents, as it is today, to tolerate floating point noise.
 */
export function coversSaleTotal(
  total: number,
  totalCash: number,
  totalTransfer: number,
  creditoBase: number,
): boolean {
  return (
    Math.round(total * 100) <=
    Math.round((totalCash + totalTransfer + creditoBase) * 100)
  );
}

/**
 * Whether the credit row of the payment sheet can be picked.
 *
 * The ONLY reason it cannot is that the sale has nothing to lend: a total of zero, which the
 * checkout already treats as its own case. Being offline is not a reason (criterion 8), the
 * permission is not a reason (ADR 0119), and the payment already covering the total is not a
 * reason either — criterion 7 needs credit ON before the overpayment. A guard wider than the
 * one case is E-032.
 *
 * `NaN > 0` is already false, so there is no guard of its own for it.
 */
export function canSellOnCredit(amountDue: number): boolean {
  return amountDue > 0;
}

/**
 * What gets persisted as `Venta.totalcash`: the sale's own cash, net of change, of tip and
 * now of credit. Bug 2 of the dossier: without the last term the debt was booked as cash in
 * the drawer.
 *
 *   totalcash + totaltransfer + creditoBase = total
 *
 * The derivation, because the shape is not obvious: `total` is
 * `Σcash + Σtransfer − Σvuelto + creditoBase − tipTotal` and `totalTransfer` is
 * `Σtransfer − tipTransfer`, so `total − totalTransfer − creditoBase` is
 * `Σcash − Σvuelto − tipCash`, which is exactly the cash the sale keeps.
 *
 * The result is NOT rounded, deliberately: with `creditoBase` at 0 this has to return the
 * very same number the POS persists today, down to the floating point noise.
 */
export function persistedCashBase(
  total: number,
  totalTransfer: number,
  creditoBase: number,
): number {
  return total - totalTransfer - creditoBase;
}
