/**
 * The DOM anchors the acceptance criteria are verified against (E-011, ADR 0125).
 *
 * TWELVE keys, every value distinct. Each one wraps the content of a node that already
 * accepts a `ReactNode` — `Stat.value`, `Stat.note`, `ReportColumn.render` — so neither
 * `StatStrip.tsx` nor `ReportDataTable.tsx` is touched.
 */
export const REPORTS_CREDIT_TEST_IDS = {
  /** The `tipo` cell of the mix row whose type is PAYMENT_MIX_CREDIT_TYPE (criteria 1, 4). */
  mixCreditType: "reportes-mix-credit-type",
  /** Its "Monto cobrado" cell, which says so instead of printing a figure (criterion 8). */
  mixCreditOriginal: "reportes-mix-credit-original",
  /** Its "Equivalente" cell (criterion 1). */
  mixCreditBase: "reportes-mix-credit-base",
  /** Its "Participación" cell (criterion 2). */
  mixCreditShare: "reportes-mix-credit-share",
  /** The footnote under the mix table. */
  mixNote: "reportes-mix-credit-note",
  /** The figure of the KPI that must NOT include credit (ADR 0132). */
  kpiCollected: "reportes-operacion-kpi-collected",
  /** Its note, which says what the figure leaves out. */
  kpiCollectedNote: "reportes-operacion-kpi-collected-note",
  /** The figure of the credit KPI, when the period has credit. */
  kpiCredit: "reportes-operacion-kpi-credit",
  /** Its note. */
  kpiCreditNote: "reportes-operacion-kpi-credit-note",
  /** The block holding the two informative lines (criterion 6, by position). */
  incomeCreditBlock: "reportes-rentabilidad-credit-block",
  incomeCreditGranted: "reportes-rentabilidad-credit-granted",
  incomeCreditCollected: "reportes-rentabilidad-credit-collected",
} as const;

/**
 * Every visible literal of this feature, fixed by `.agents/designs/F-037.md` § 0.1.
 * Eleven members: nine strings and TWO functions of `sharePercent`, `kpiShareNote` and
 * `kpiCreditNote`.
 *
 * The separator of `kpiCreditNote` is `·` U+00B7 (MIDDLE DOT), the same one
 * `CREDIT_COPY.closeDialogNotice` of F-034 already uses. `toFixed` is locale
 * independent, so both functions render a decimal POINT, never a comma.
 */
export const REPORTS_CREDIT_COPY = {
  kpiCreditLabel: "Ventas a crédito",
  kpiCollectedNote: "No incluye las ventas a crédito",
  kpiShareNote: (sharePercent: number) =>
    `${sharePercent.toFixed(1)}% del total vendido`,
  kpiCreditNote: (sharePercent: number) =>
    `${sharePercent.toFixed(1)}% del total vendido · no entró a caja`,
  mixRowLabel: "Ventas a crédito",
  mixNotCollectedCell: "No cobrado",
  mixNote:
    "Las ventas a crédito no son un método de pago: entran con fila propia para que los porcentajes se repartan sobre todo lo vendido, no solo sobre lo cobrado.",
  incomeBlockTitle: "Crédito del período",
  incomeGrantedLabel: "Ventas a crédito",
  incomeCollectedLabel: "Cobros de crédito",
  incomeBlockCaption:
    "El margen de una venta a crédito ya se contó el día de la entrega, y un cobro solo mueve dinero: por eso ninguna de las dos aparece arriba.",
} as const;
