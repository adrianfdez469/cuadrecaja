/**
 * The synthetic row the payment mix adds for credit sales.
 *
 * It is a REPORT ROW, not a payment method: `pagoLineaSchema.tipo` stays
 * `z.enum(["cash","transfer"])` (ADR 0104) and this value never reaches it.
 */
export const PAYMENT_MIX_CREDIT_TYPE = "credito";
