import type { ICreditInvariantViolation } from "@/lib/cuentasPorCobrar/creditInvariant";

/**
 * Every literal, bound and message of the credit sale (F-034).
 *
 * Its ONLY import is a type. Nothing from `src/schemas/**` imports this module, which is
 * why `EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE` lives in `src/schemas/pago.ts` and not here:
 * importing it back would close a cycle between two modules that evaluate schemas at the
 * top level (E-028).
 */

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The message each violation is answered with. FIXED strings with no interpolation: the
 * payload that broke the rule carries amounts and a customer id, and a message that quotes
 * it puts them in the logs and in the client (E-031).
 *
 * A Record over the closed vocabulary on purpose: a sixth violation does not compile until
 * its message is written.
 */
export const CREDIT_INVARIANT_ERROR_MESSAGE: Record<
  ICreditInvariantViolation,
  string
> = {
  CREDIT_WITHOUT_CUSTOMER: "Una venta a credito necesita un cliente del negocio",
  CREDIT_WITH_CHANGE: "Una venta a credito no puede dar vuelto",
  CREDIT_WITH_TIP: "Una venta a credito no admite propina",
  CREDIT_EXCEEDS_TOTAL: "El credito no puede superar el total de la venta",
  TOTAL_MISMATCH: "Los importes de la venta no cuadran con su total",
};

/** The body of a rejected credit payload, before anything reads the numbers. */
export const CREDIT_EXTRAS_INVALID_MESSAGE =
  "Datos de credito invalidos en la venta";

/**
 * One retry, and only one: the sole failure it can resolve is a lost race between two
 * sales naming the same brand-new customer at the same time (E-038, ADR 0117). Same number
 * and same reason as CLIENTES_UPSERT_RETRIES.
 */
export const CREDIT_CUSTOMER_UPSERT_RETRIES = 1;

/** Machine-readable marker of the answer below, for the client to branch on. */
export const CREDIT_CUSTOMER_CONFLICT_CODE = "CREDIT_CUSTOMER_CONFLICT";

export const CREDIT_CUSTOMER_CONFLICT_MESSAGE =
  "No se pudo registrar el cliente de la venta a credito. Vuelva a enviar la venta";

/* -------------------------------------------------------------------------- */
/* Ticket and screen                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The two ticket labels. FIXED HERE and not by the design step: criterion 11 is verified by
 * looking for them inside the generated ticket, and a label that moves after the test is
 * written turns a correct implementation into a rejection (E-016, E-018). The ui-designer
 * does not change these; if it needs to, it goes back to the arch-guardian.
 *
 * Unaccented on purpose: the ticket prints over an ESC/POS character table that does not
 * guarantee them.
 */
export const CREDIT_TICKET_COPY = {
  clienteLabel: "Cliente",
  saldoLabel: "Saldo a credito",
} as const;

/**
 * The checkout copy, CLOSED at eleven keys by .agents/designs/F-034.md § 8. The values are the
 * designer's; what the contract fixes is that they live here, in a .ts, in one place, so a test
 * can import them and no .tsx can grow a literal of its own (E-015, E-016).
 *
 * `ctaWithCredit` is 16 characters and was MEASURED with a real viewport on the button itself,
 * not on its wrapper (E-011): 173.45 px of text in a 260 px content box at 320 px. The backlog's
 * fallback — keeping "VENDER" and moving the notice to CheckoutPayBar's `status` — is therefore
 * NOT taken, which is why there is no `payBarStatus` key here.
 *
 * Accented, unlike CREDIT_TICKET_COPY: these are screen strings, and the rest of the checkout
 * is accented too.
 */
export const CREDIT_CHECKOUT_COPY = {
  addPaymentRow: "A crédito",
  addPaymentRowHint: "Queda como deuda de un cliente",
  addPaymentRowBlocked: "Esta venta no tiene importe que fiar.",
  blockTitle: "A crédito",
  blockChangeCliente: "Cambiar",
  blockClearLabel: "Quitar el crédito",
  blockClienteNuevo: "Se creará al sincronizar",
  ctaWithCredit: "VENDER A CRÉDITO",
  crearSinConexionEnVenta:
    "Sin conexión: el nombre se guarda con la venta y el cliente se crea al sincronizar.",
  crearSinNombreEnVenta:
    "Escribe el nombre del cliente para poder fiarle esta venta.",
  nombreInvalido:
    "Ese nombre trae caracteres que no se pueden imprimir. Suele pasar cuando el escáner se dispara sobre el campo del nombre: bórralo y escríbelo otra vez.",
} as const;

/**
 * Localisation classes for the qa, CLOSED at twelve by .agents/designs/F-034.md § 9. Matched with
 * `classList.contains`, NEVER by prefix: `cc-credit-block` is a prefix of five of them, on
 * purpose (E-011, E-016).
 */
export const CREDIT_DOM = {
  checkout: "cc-checkout",
  paySheet: "cc-pay-sheet",
  addRow: "cc-credit-add-row",
  addRowCliente: "cc-credit-add-cliente",
  addRowReason: "cc-credit-add-reason",
  block: "cc-credit-block",
  blockAmount: "cc-credit-block-amount",
  blockCliente: "cc-credit-block-cliente",
  blockPick: "cc-credit-block-pick",
  blockClear: "cc-credit-block-clear",
  blockClienteNuevo: "cc-credit-block-nuevo",
  nameOnlyNote: "cc-credit-name-only-note",
} as const;
