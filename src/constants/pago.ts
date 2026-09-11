/**
 * Logged when a payment line carries a `tipo` that is neither "cash" nor "transfer".
 *
 * A FIXED string with no interpolation: a payment line can carry a transfer destination
 * and amounts, and a warning that quotes the object it received puts that in the logs
 * (E-031). It is also what the criterion-4 tests assert on, so its exact text is part of
 * the contract.
 */
export const UNKNOWN_PAYMENT_LINE_TYPE_WARNING =
  "Payment line with unknown tipo ignored: not counted as cash, as transfer, nor in equivalenteBase";
