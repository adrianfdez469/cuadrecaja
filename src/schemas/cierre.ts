import { z } from "zod";
import { tiendaSchema } from "./tienda";
import { initialCashFundEntrySchema } from "./initialCashFund";
import { CIERRE_ETIQUETA_MAX_LENGTH } from "@/constants/cierre";

export const cierrePeriodoSchema = z.object({
  id: z.string().uuid(),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().optional(),
  // The operator's own name for the period. NULL/absent means unnamed: the
  // readers show the fechaInicio-fechaFin range instead (`resolveCierreLabel`).
  etiqueta: z.string().nullable().optional(),
  tiendaId: z.string().uuid(),
  tienda: tiendaSchema,
  initialCashFund: initialCashFundEntrySchema.optional(),
  totalVentas: z.number(),
  totalGanancia: z.number(),
  totalInversion: z.number(),
  totalTransferencia: z.number(),
  totalVentasPropias: z.number().optional(),
  totalVentasConsignacion: z.number().optional(),
  totalGananciasPropias: z.number().optional(),
  totalGananciasConsignacion: z.number().optional(),
  totalGastos: z.number().optional(),
  totalGananciaFinal: z.number().optional(),
  totalComprasCaja: z.number().optional(),
  totalMerma: z.number().optional(),
  totalDevoluciones: z.number().optional(),
  totalTips: z.number().optional(),
  totalVentasBrutas: z.number().optional(),
  totalDescuentos: z.number().optional(),
  // The three credit figures the closing engine stores on every close and
  // recalculation. Their definition lives in the docstrings of
  // `CierreStoredTotals` (src/lib/cierre/computeCierreTotals.ts); this file is
  // only their Zod mirror. Optional here for the same reason every figure added
  // after the first engine is: a payload built by an older path may omit them.
  totalCreditoOtorgado: z.number().optional(),
  totalCobrosCredito: z.number().optional(),
  totalPorCobrarAlCierre: z.number().optional(),
  // When the stored figures were last derived from the sales (ADR 0036).
  // Absent on periods closed by the previous engine, until recalculated.
  totalsComputedAt: z.coerce.date().nullable().optional(),
  // The sales of the period changed after its figures were stored — or they
  // were never stored by the current engine. Shown as a warning with the
  // recalculation action next to it.
  totalesDesactualizados: z.boolean().optional(),
});

const cierreProductoVendidosSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  costo: z.number(),
  precio: z.number(),
  cantidad: z.number(),
  total: z.number(),
  ganancia: z.number(),
  descuento: z.number().optional(),
  proveedor: z.object({ id: z.string(), nombre: z.string() }).optional(),
  enConsignacion: z.boolean().optional(),
  productoId: z.string().uuid(),
});

const resumenMonedaCierreSchema = z.object({
  id: z.string(),
  monedaCode: z.string(),
  totalEfectivo: z.number(),
  totalTransfer: z.number(),
  equivalenteBase: z.number(),
  // Valores antes de restar gastos/compras/devoluciones (para mostrar bruto tachado -> final)
  totalEfectivoBruto: z.number().optional(),
  equivalenteBaseBruto: z.number().optional(),
  // Fondo inicial de caja de esta moneda, ya incluido en totalEfectivo/equivalenteBase
  initialFund: z.number().optional(),
  // Propina incluida en totalEfectivo/totalTransfer. Informativa: no se resta
  // de la caja, el conteo de billetes sigue cuadrando contra totalEfectivo.
  tipCash: z.number().optional(),
  tipTransfer: z.number().optional(),
});

export type IResumenMonedaCierre = z.infer<typeof resumenMonedaCierreSchema>;

const deduccionTipoEnum = z.enum(["GASTO", "MERMA", "DEVOLUCION", "COMPRA"]);

// Item de deducción (gasto, merma, devolución o compra) tal como se desglosa
// en las cards de Ganancia Final y en el detalle de Desglose por Moneda
const deduccionItemSchema = z.object({
  id: z.string(),
  tipo: deduccionTipoEnum,
  label: z.string(),
  monto: z.number(),
  motivo: z.string().nullable().optional(),
  esAdHoc: z.boolean().optional(),
});

export type IDeduccionTipo = z.infer<typeof deduccionTipoEnum>;
export type IDeduccionItem = z.infer<typeof deduccionItemSchema>;

export const cierreDataSchema = z.object({
  fechaInicio: z.coerce.date().optional(),
  fechaFin: z.coerce.date().optional(),
  etiqueta: z.string().nullable().optional(),
  tienda: tiendaSchema.optional(),
  productosVendidos: z.array(cierreProductoVendidosSchema),
  totalVentas: z.number(),
  totalInversion: z.number().optional(),
  totalsComputedAt: z.coerce.date().nullable().optional(),
  totalesDesactualizados: z.boolean().optional(),
  totalVentasBrutas: z.number().optional(),
  totalDescuentos: z.number().optional(),
  totalGanancia: z.number(),
  totalTransferencia: z.number(),
  totalVentasPropias: z.number().optional(),
  totalVentasConsignacion: z.number().optional(),
  totalVentasPropiasNeto: z.number().optional(),
  totalVentasConsignacionNeto: z.number().optional(),
  totalGananciasPropias: z.number().optional(),
  totalGananciasConsignacion: z.number().optional(),
  totalTransferenciasByDestination: z
    .array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        total: z.number(),
      }),
    )
    .optional(),
  totalVentasPorUsuario: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      total: z.number(),
    }),
  ),
  // Propinas del período, en moneda base. Nunca forman parte de totalVentas
  // ni de la ganancia: el desglose por cajero es lo que permite repartirlas.
  totalTips: z.number().optional(),
  // The three credit figures of the period, mirrored from `CierreStoredTotals`
  // (src/lib/cierre/computeCierreTotals.ts), which is where their definition
  // lives. Optional: a payload built by an older path may omit them.
  totalCreditoOtorgado: z.number().optional(),
  totalCobrosCredito: z.number().optional(),
  totalPorCobrarAlCierre: z.number().optional(),
  tipsPorUsuario: z
    .array(
      z.object({
        id: z.string(),
        nombre: z.string(),
        total: z.number(),
      }),
    )
    .optional(),
  resumenMonedas: z.array(resumenMonedaCierreSchema).optional(),
  totalGastos: z.number().optional(),
  totalGananciaFinal: z.number().optional(),
  totalComprasCaja: z.number().optional(),
  totalMerma: z.number().optional(),
  totalDevoluciones: z.number().optional(),
  // Todo lo que resta de la ganancia final (gastos operativos, merma, devoluciones)
  gananciaDeducciones: z.array(deduccionItemSchema).optional(),
  // Todo lo que resta de la caja, agrupado por moneda (gastos, compras en efectivo, reembolsos)
  cajaDeducciones: z
    .record(z.string(), z.array(deduccionItemSchema))
    .optional(),
});

export const summaryCierreSchema = z.object({
  cierres: z.array(
    cierrePeriodoSchema.omit({ tienda: true }).extend({
      totalVentasBrutas: z.number().optional(),
      totalDescuentos: z.number().optional(),
    }),
  ),
  sumTotalGanancia: z.number(),
  sumTotalInversion: z.number(),
  sumTotalVentas: z.number(),
  sumTotalTransferencia: z.number(),
  totalItems: z.number(),
  sumTotalVentasPropias: z.number().optional(),
  sumTotalVentasConsignacion: z.number().optional(),
  sumTotalGananciasPropias: z.number().optional(),
  sumTotalGananciasConsignacion: z.number().optional(),
  desgloseTransferencias: z
    .array(
      z.object({
        destinationName: z.string(),
        transferDestinationId: z.string(),
        _sum: z.object({ totaltransfer: z.number() }),
      }),
    )
    .optional(),
  sumTotalVentasBrutas: z.number().optional(),
  sumTotalDescuentos: z.number().optional(),
  sumTotalGastos: z.number().optional(),
  sumTotalMerma: z.number().optional(),
  sumTotalDevoluciones: z.number().optional(),
  sumTotalComprasCaja: z.number().optional(),
  sumTotalGananciaFinal: z.number().optional(),
  sumTotalTips: z.number().optional(),
  // The two FLOW figures, summed across the periods the filter matched.
  // `totalPorCobrarAlCierre` is deliberately absent: it is a stock, and summing
  // it across periods counts the same debt once per period (dosier § 6).
  sumTotalCreditoOtorgado: z.number().optional(),
  sumTotalCobrosCredito: z.number().optional(),
});

export const cierreStoredTotalsSchema = z.object({
  totalVentas: z.number(),
  totalVentasBrutas: z.number(),
  totalDescuentos: z.number(),
  totalInversion: z.number(),
  totalGanancia: z.number(),
  totalTransferencia: z.number(),
  totalVentasPropias: z.number(),
  totalVentasConsignacion: z.number(),
  totalGananciasPropias: z.number(),
  totalGananciasConsignacion: z.number(),
  totalGastos: z.number(),
  totalGananciaFinal: z.number(),
  totalComprasCaja: z.number(),
  totalMerma: z.number(),
  totalDevoluciones: z.number(),
  totalTips: z.number(),
  // Required here, unlike in the payload schemas above: this object is the
  // exact mirror of `CierreStoredTotals`, where the three are required. A
  // missing one would leave the `before` of a recalculation mistyped.
  totalCreditoOtorgado: z.number(),
  totalCobrosCredito: z.number(),
  totalPorCobrarAlCierre: z.number(),
});

const resumenMonedaComparableSchema = z.object({
  monedaCode: z.string(),
  totalEfectivo: z.number(),
  totalTransfer: z.number(),
  equivalenteBase: z.number(),
});

/** Response of POST /api/cierre/[tiendaId]/[cierreId]/recalculate. */
export const recalculateCierreResultSchema = z.object({
  applied: z.boolean(),
  drifted: z.boolean(),
  totalsComputedAt: z.string().nullable(),
  before: cierreStoredTotalsSchema,
  after: cierreStoredTotalsSchema,
  resumenBefore: z.array(resumenMonedaComparableSchema),
  resumenAfter: z.array(resumenMonedaComparableSchema),
  liquidacionesConservadas: z.number(),
});

export type ICierreStoredTotals = z.infer<typeof cierreStoredTotalsSchema>;
export type IRecalculateCierreResult = z.infer<
  typeof recalculateCierreResultSchema
>;
/**
 * Body of `PATCH /api/cierre/[tiendaId]/[cierreId]/etiqueta`.
 *
 * `null` — or a blank string, which the route normalizes to `null` — clears the
 * label: that is how the operator goes back to seeing the date range.
 */
export const updateCierreEtiquetaSchema = z.object({
  etiqueta: z.string().max(CIERRE_ETIQUETA_MAX_LENGTH).nullable(),
});

export type IUpdateCierreEtiqueta = z.infer<typeof updateCierreEtiquetaSchema>;

export type ICierrePeriodo = z.infer<typeof cierrePeriodoSchema>;
export type ICierreData = z.infer<typeof cierreDataSchema>;
export type ISummaryCierre = z.infer<typeof summaryCierreSchema>;

/**
 * The two flow figures as they arrive in any cierre payload: the detail of a
 * period, a row of the history, or the drawer. Both optional, because that is
 * how `cierrePeriodoSchema` declares them.
 */
export const creditFlowSourceSchema = cierrePeriodoSchema.pick({
  totalCreditoOtorgado: true,
  totalCobrosCredito: true,
});

/** The same two figures, normalized to numbers. Base currency, always. */
export const creditFlowSchema = z.object({
  /** Credit granted in the period — CierrePeriodo.totalCreditoOtorgado. */
  granted: z.number(),
  /** Debt collected in the period — CierrePeriodo.totalCobrosCredito. */
  collected: z.number(),
});

/** The two page-level sums the history reads to decide whether to show its columns. */
export const creditColumnSumsSchema = summaryCierreSchema.pick({
  sumTotalCreditoOtorgado: true,
  sumTotalCobrosCredito: true,
});

/**
 * The two informative lines one currency row of the cash breakdown shows.
 * `null` on a line means that line is not shown.
 */
export const currencyCreditLinesSchema = z.object({
  granted: z.number().nullable(),
  collected: z.number().nullable(),
});

export type ICreditFlowSource = z.infer<typeof creditFlowSourceSchema>;
export type ICreditFlow = z.infer<typeof creditFlowSchema>;
export type ICreditColumnSums = z.infer<typeof creditColumnSumsSchema>;
export type ICurrencyCreditLines = z.infer<typeof currencyCreditLinesSchema>;
