import { pagadaConUnSoloPago } from "@/lib/currency";
import { formatMontoEnMoneda } from "@/utils/formatters";
import type { IPagoLinea } from "@/schemas/pago";

/**
 * Every reason a sale refuses to give up a product or itself, in the order they are evaluated.
 * THE ORDER IS THE CONTRACT and the first one to fire wins — same shape as
 * CREDIT_INVARIANT_VIOLATIONS and MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS.
 */
export const VENTA_DELETE_BLOCK_REASONS = [
  "CREDITO_CON_COBROS",
  "CREDITO_CON_MOVIMIENTOS",
  "MULTIPLES_PAGOS",
] as const;

export type IVentaDeleteBlockReason =
  (typeof VENTA_DELETE_BLOCK_REASONS)[number];

/**
 * The HTTP status each reason gets, declared once so the two DELETE routes do not restate it.
 *
 * The two credit reasons are 409 and MULTIPLES_PAGOS stays 400, and that difference is deliberate
 * (ADR 0133): 400 means "not with these data", 409 means "not with this sale". 403 is ruled out
 * for all three, because axiosClient replaces the body of ANY 403 with a generic permission error
 * (E-009) and criterion 5 asks for the reason to reach the screen.
 */
export const VENTA_DELETE_BLOCK_HTTP_STATUS: Record<
  IVentaDeleteBlockReason,
  400 | 409
> = {
  CREDITO_CON_COBROS: 409,
  CREDITO_CON_MOVIMIENTOS: 409,
  MULTIPLES_PAGOS: 400,
};

/**
 * The visible reason for the TWO NEW blocks, in one place, used by the API body and by the
 * Tooltip of the three components.
 *
 * MULTIPLES_PAGOS IS DELIBERATELY ABSENT. Its wording already exists in three call sites and the
 * route's and the components' strings differ by one word; unifying them would rewrite copy that
 * was verified before this feature (E-018). Each caller keeps its own literal for that reason.
 *
 * The words are the ones `.agents/designs/F-037.md` § 0.2 fixed, and this module is the only
 * place they live. The collection message NAMES the count and the amount, because criterion 6
 * measures those two values and not a category (E-016), and its singular is a real path: one
 * collection is already enough to block.
 */
export const VENTA_DELETE_BLOCK_TEXT = {
  creditoConCobros: (
    cobros: number,
    cobrosMontoBase: number,
    monedaBase: string,
  ): string =>
    `Esta venta ya tiene ${cobros} ${cobros === 1 ? "cobro" : "cobros"} por ${formatMontoEnMoneda(cobrosMontoBase, monedaBase)}. Ese dinero ya entró a una caja: revierte los cobros en Cuentas por Cobrar antes de borrar.`,
  creditoConMovimientos: (): string =>
    "La deuda de esta venta ya tiene movimientos en su historial. Borrar la venta los borraría con ella, y ese historial ya está contado en un cierre.",
};

/**
 * The minimum the gate needs to know about the debt. STRUCTURAL, so this module does not import
 * src/schemas/ventaCredito.ts, which imports VENTA_DELETE_BLOCK_REASONS from here (E-028).
 */
export interface IVentaCreditoGateInput {
  cobros: number;
  movimientos: number;
}

export interface IVentaDeleteGateInput {
  /** null when the sale has no CuentaPorCobrar. */
  credito?: IVentaCreditoGateInput | null;
  /** As persisted. Only the length is read, through pagadaConUnSoloPago. */
  pagosDetalle?: Pick<IPagoLinea, "moneda">[] | null;
  /** VentaProducto rows the sale still has. Defaults to 0. */
  productos?: number;
}

/**
 * A FLAT shape rather than a discriminated union, for the same reason ICreditInvariantResult and
 * IMovimientoDecision are flat: `strict` is off in this project, so a boolean discriminant does
 * not narrow (E-036). Callers read `veredicto.reason === null`, never `if (!veredicto.allowed)`
 * expecting narrowing.
 */
export interface IVentaDeleteVeredicto {
  allowed: boolean;
  /** null when nothing blocks. */
  reason: IVentaDeleteBlockReason | null;
}

export interface IVentaDeleteGate {
  /**
   * Deleting ONE product. When the sale has one product left this MIRRORS `venta`, because that
   * path deletes the whole sale — inside the product route it is the `esUltimoProducto` shortcut,
   * and in the two POS drawers it is the branch that calls onDeleteSale.
   */
  producto: IVentaDeleteVeredicto;
  /** Deleting the WHOLE sale. Credit reasons only: several payment lines never block this. */
  venta: IVentaDeleteVeredicto;
}

/**
 * PURE. The composed gate, and THE ONLY definition of it. Its four callers import it: the three
 * front components and the product DELETE route (the sale DELETE route reads `venta`).
 *
 * WHAT IT BLOCKS, and why it is not "live debt": money already collected against the sale entered
 * the drawer of a period that may be closed, and shrinking or deleting the sale afterwards leaves
 * the collected money without a sale to belong to. A live debt with nothing collected blocks
 * NOTHING — that is criterion 8, which deletes a product from exactly such a sale. The full
 * argument, and the tension it resolves between criteria 5 and 8, is in ADR 0133.
 *
 * `pagadaConUnSoloPago` (src/lib/currency.ts) is IMPORTED, never reimplemented, and its semantics
 * are untouched: "zero or one payment" is correct for what it was written for.
 */
export function evaluateVentaDeleteGuard(
  input: IVentaDeleteGateInput,
): IVentaDeleteGate {
  const credito = input?.credito ?? null;

  const creditReason: IVentaDeleteBlockReason | null =
    credito === null
      ? null
      : (Number(credito.cobros) || 0) > 0
        ? "CREDITO_CON_COBROS"
        : (Number(credito.movimientos) || 0) > 0
          ? "CREDITO_CON_MOVIMIENTOS"
          : null;

  const venta: IVentaDeleteVeredicto = {
    allowed: creditReason === null,
    reason: creditReason,
  };

  const ultimoProducto = (Number(input?.productos) || 0) <= 1;

  const producto: IVentaDeleteVeredicto = ultimoProducto
    ? venta
    : creditReason !== null
      ? { allowed: false, reason: creditReason }
      : !pagadaConUnSoloPago(input?.pagosDetalle)
        ? { allowed: false, reason: "MULTIPLES_PAGOS" }
        : { allowed: true, reason: null };

  return { producto, venta };
}
