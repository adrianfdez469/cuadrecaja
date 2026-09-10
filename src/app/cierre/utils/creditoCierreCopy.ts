type CreditCopy = {
  /** Title of `CreditoCard`. */
  cardTitle: string;
  /** Label of the granted figure inside the card. */
  cardGrantedLabel: string;
  /** Label of the collected figure inside the card. */
  cardCollectedLabel: string;
  /** One sentence under the two figures: what is in the drawer and what is not. */
  cardHint: string;
  /**
   * The credit-sales line of a currency row. MUST state that the amount did
   * NOT enter the drawer (criterion 4). Receives the already formatted amount.
   */
  currencyGrantedLine: (amount: string) => string;
  /**
   * The debt-collected line of a currency row. Speaks about the PERIOD's cash,
   * never about this row's cash: in a multi-currency negocio the collection may
   * have entered another currency's drawer.
   */
  currencyCollectedLine: (amount: string) => string;
  /** The footnote under the net sales cell (criterion 7). */
  totalsFootnote: (amount: string) => string;
  /** The non-blocking notice of the close dialog (criterion 8). */
  closeDialogNotice: (granted: string, collected: string) => string;
  /** Header of the granted column of the history table. */
  historyGrantedHeader: string;
  /** Header of the collected column of the history table. */
  historyCollectedHeader: string;
  /** Row label of the granted figure in the recalculation dialog. */
  recalcGrantedRow: string;
  /** Row label of the collected figure in the recalculation dialog. */
  recalcCollectedRow: string;
};

/**
 * Every word this feature puts on screen, in one place, so a criterion is
 * verified against the same value that paints it instead of against a
 * transcription of it (E-016).
 */
export const CREDIT_COPY: CreditCopy = {
  // Literals from .agents/designs/F-034.md
  cardTitle: "Crédito del período",
  cardGrantedLabel: "Ventas a crédito",
  cardCollectedLabel: "Cobros de crédito",
  cardHint:
    "Los cobros ya están dentro del efectivo del período. Las ventas a crédito no: se cobran más adelante.",
  currencyGrantedLine: (amount) =>
    `Ventas a crédito ${amount} — ese monto no entró a la caja: no lo restes del conteo`,
  currencyCollectedLine: (amount) =>
    `Cobros de crédito ${amount} — ya están en el efectivo del período`,
  totalsFootnote: (amount) => `Incluye ${amount} a crédito`,
  closeDialogNotice: (granted, collected) =>
    `Ventas a crédito: ${granted} · Cobros de crédito: ${collected}. Ninguna de las dos descuadra la caja.`,
  historyGrantedHeader: "Crédito",
  historyCollectedHeader: "Cobros",
  recalcGrantedRow: "Ventas a crédito",
  recalcCollectedRow: "Cobros de crédito",
};
