import type { ChangeDistribution } from "@/app/pos/utils/changeMath";
import type { PaymentLine } from "@/app/pos/utils/paymentMath";

/**
 * What the «Cobro registrado» screen has to say about the sale just made.
 *
 * Captured by the checkout at the moment of confirming, because the payment
 * lines and the change split live in its state and are gone the instant the
 * basket is cleared for the next sale.
 */
export interface SaleReceipt {
  /** What the customer covered, tip included, in the base currency. */
  amountBase: number;
  base: string;
  tipTotalBase: number;
  /**
   * The change handed back, by currency. Empty both when the payment was
   * exact and when what was owed back was too small to hand over — see
   * `undeliverableChangeBase` for telling the two apart.
   */
  change: ChangeDistribution;
  /**
   * Overpayment left in the drawer because no denomination could express it
   * — 0,25 on a 2,75 sale covered with 3. Zero on an exact payment.
   */
  undeliverableChangeBase: number;
  lines: PaymentLine[];
  /** When the sale was confirmed, as a timestamp. */
  confirmedAt: number;
}
