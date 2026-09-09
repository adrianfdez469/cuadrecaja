/**
 * Constants of the closing period (`CierrePeriodo`) that both the API and the
 * screens need to agree on.
 */

/**
 * Max length of the operator-editable label of a closing period.
 *
 * It is a name, not a note: it has to stay readable inside a table cell and a
 * card title on a phone, so it is capped well below what the column allows.
 */
export const CIERRE_ETIQUETA_MAX_LENGTH = 60;

/**
 * Smallest instant this project can distinguish: Prisma maps DateTime to
 * timestamp(3). Every cutoff boundary is built by adding or subtracting it.
 */
export const SALES_CUTOFF_STEP_MS = 1;

// Anchors and fixed copy for the sales-cutoff UI. The verification criteria of
// the design contract locate every region by these exact strings, so a change
// here is a change to what QA runs.
export const SALES_CUTOFF_BANNER_LABEL = "Corte de ventas";
export const SALES_CUTOFF_PREPARE_LABEL = "Preparar el cierre";
export const SALES_CUTOFF_DIALOG_TITLE = "Seleccionar ventas";
export const SALES_CUTOFF_SHORTCUTS_LABEL = "Atajos de selección";
export const SALES_CUTOFF_LIST_LABEL = "Ventas del período";
export const SALES_CUTOFF_LINE_LABEL = "Corte del cierre";
export const SALES_CUTOFF_DEFERRED_PILL = "Próximo período";
export const SALES_CUTOFF_DEFERRED_NOTICE_LABEL =
  "Ventas que pasan al próximo período";

/** Height of a sale row in the cutoff dialog: two lines and a multi-currency amount. */
export const SALES_CUTOFF_ROW_HEIGHT = 72;

/**
 * The `{ error }` bodies the closing route answers with.
 *
 * They are constants because the screen has to tell the two 409s apart to pick
 * its message, and the contract deliberately keeps the bodies free of a `code`
 * field: the string IS the discriminator, so both sides read it from here
 * instead of retyping it.
 */
export const CIERRE_CLOSE_ERRORS = {
  periodAlreadyClosed: "El período ya fue cerrado",
  salesCutoffChanged: "El corte del cierre cambió: no se cerró nada",
  salesCutoffOutOfRange: "El corte ya no cae dentro del período",
  deferredSalesMismatch:
    "Las ventas que pasaban al próximo período cambiaron: no se cerró nada",
} as const;

/** What the closing screen says after each of those answers. */
export const CIERRE_CLOSE_MESSAGES = {
  salesCutoffChanged:
    "El corte cambió mientras se cerraba la caja. No se cerró nada: revisa el corte y vuelve a intentarlo.",
  deferredSalesMismatch:
    "Una de las ventas que iban al próximo período cambió mientras se cerraba. No se cerró nada: vuelve a intentarlo.",
  periodAlreadyClosed: "La caja ya estaba cerrada. Se actualizó la pantalla.",
} as const;

/** What the cutoff dialog says when another cashier moved the cut first. */
export const SALES_CUTOFF_CONFLICT_MESSAGE =
  "Otro cajero cambió el corte mientras tenías esta pantalla abierta. No se guardó nada.";

/** What the cutoff dialog says when saving failed for any other reason. */
export const SALES_CUTOFF_SAVE_ERROR_MESSAGE =
  "No se pudo guardar el corte. Vuelve a intentarlo.";
