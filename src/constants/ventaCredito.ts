import type { PillHue } from "@/components/StatusPill";
import type { IVentaCreditoEstado } from "@/lib/cuentasPorCobrar/ventaCreditoEstado";
import { formatMontoEnMoneda } from "@/utils/formatters";

/**
 * Every literal and every location class the credit of a sale adds to `/ventas`, to its detail
 * dialog and to the POS drawer, fixed by `.agents/designs/F-035.md` § 0.3 and § 0.4. NO component
 * writes a literal of its own (E-015, E-016).
 *
 * The nine labels that say here what the debtor panel already says are IMPORTED from
 * `CUENTAS_POR_COBRAR_COPY` (F-033) by the components that need them, never restated here: a
 * second wording for the same fact is E-014/E-039.
 *
 * `PillHue` arrives through an `import type`, which is erased before anything runs: no value of
 * a `.tsx` is pulled into this module (E-015), exactly as `src/constants/cuentasPorCobrar.ts`
 * does.
 */
export const VENTA_CREDITO_COPY = {
  /* ---- The chip, shared with F-036 ---- */
  chipConSaldo: "A crédito",
  chipSaldada: "Crédito saldado",
  chipConSaldoConSaldo: (saldo: number, monedaBase: string): string =>
    `A crédito · ${formatMontoEnMoneda(saldo, monedaBase)}`,

  /* ---- The list ---- */
  columnaCredito: "Crédito",
  /**
   * The label lives INSIDE the literal: the neighbouring column is the SELLER, so two people's
   * names in one row are indistinguishable without it. And it is one single literal so the
   * element's own text is one text node, which is what makes design criterion 12 measurable.
   */
  listaCliente: (nombre: string): string => `Cliente: ${nombre}`,

  /* ---- The credit block of the detail dialog ---- */
  bloqueTitulo: "Crédito de esta venta",
  bloqueDeudor: "Deudor",
  /** The link's accessible name, never its visible text: the visible text is the debtor's name. */
  bloqueVerPanel: "Ver la deuda de este cliente",
  bloqueReferencia: (monedaBase: string): string =>
    `Referencia informativa. La deuda se lleva en ${monedaBase}.`,
  bloqueColumnaFormaDePago: "Forma de pago",
  /**
   * Credit is NOT a third form of payment: `pagoLineaSchema.tipo` is `cash | transfer` and stays
   * that way (ADR 0104). There are two labels and no more.
   */
  bloqueFormaDePago: (tipo: "cash" | "transfer", moneda: string): string =>
    `${tipo === "cash" ? "Efectivo" : "Transferencia"} (${moneda})`,
  /**
   * It does NOT say "no physical money". A REVERSION_ABONO may well have handed money back
   * outside the ledger, so claiming there was none would be an absolute the data does not
   * support (E-017). What is true, and what it says, is that the row records no form of payment.
   */
  bloqueSinFormaDePago: "Sin forma de pago registrada",
  bloqueEquivalente: (montoBase: number, monedaBase: string): string =>
    `≈ ${formatMontoEnMoneda(montoBase, monedaBase)}`,
  bloqueErrorTitulo: "No se pudieron cargar los movimientos",
  bloqueErrorDescripcion:
    "El deudor y el saldo de arriba están al día. Vuelve a intentarlo.",
  bloqueOfflineTitulo: "Sin conexión",
  bloqueOfflineDescripcion:
    "Los movimientos de la deuda se leen del servidor. Vuelve a intentarlo cuando haya conexión.",

  /* ---- The search box ---- */
  buscarPlaceholder: "Buscar venta o cliente...",
  buscarPlaceholderCorto: "Buscar...",
} as const;

/**
 * The visible label of each credit state. `SIN_CREDITO` is `null` because a cash sale carries NO
 * mark at all (criterion 1). A `Record` over the closed vocabulary, so a fourth state does not
 * compile until it gets a label.
 *
 * `CON_SALDO` and `SALDADA` are deliberately DIFFERENT strings: that difference is the text half
 * of criterion 1.
 */
export const CREDITO_ESTADO_LABEL: Record<IVentaCreditoEstado, string | null> = {
  SIN_CREDITO: null,
  CON_SALDO: VENTA_CREDITO_COPY.chipConSaldo,
  SALDADA: VENTA_CREDITO_COPY.chipSaldada,
};

/**
 * The ink of each credit state, and it is the colour half of criterion 1: the two credit states
 * take DIFFERENT hues.
 *
 * NEITHER is `accent` — the violet is reserved for action and selection and a state pill is not
 * pressable — and neither is `negative`: owing money is not a fault, it is the business model of
 * this epic (F-033 § 6). `caution` is the same ink the panel paints an open account with.
 */
export const CREDITO_ESTADO_HUE: Record<IVentaCreditoEstado, PillHue | null> = {
  SIN_CREDITO: null,
  CON_SALDO: "caution",
  SALDADA: "positive",
};

/**
 * The location classes. Same mould and same rule as `CREDIT_DOM` (F-032) and
 * `CUENTAS_POR_COBRAR_DOM` (F-033): compared ALWAYS with `classList.contains`, never by prefix,
 * and NONE of these is a prefix of another, on purpose. They exist so a verification finds the
 * element that IS the thing, without climbing up from an icon or leaning on an internal MUI
 * class (E-011).
 */
export const VENTA_CREDITO_DOM = Object.freeze({
  chip: "cc-venta-credito-chip",
  cliente: "cc-venta-credito-cliente",
  bloque: "cc-venta-credito-bloque",
  deudor: "cc-venta-credito-deudor",
  montoOriginal: "cc-venta-credito-monto",
  saldo: "cc-venta-credito-saldo",
  referencia: "cc-venta-credito-referencia",
  libro: "cc-venta-credito-libro",
  movimiento: "cc-venta-credito-movimiento",
  pago: "cc-venta-credito-pago",
  motivo: "cc-venta-borrado-motivo",
  accionProducto: "cc-venta-borrado-producto",
  accionVenta: "cc-venta-borrado-venta",
} as const);
