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
  // When the stored figures were last derived from the sales (ADR 0036).
  // Absent on periods closed by the previous engine, until recalculated.
  totalsComputedAt: z.coerce.date().nullable().optional(),
  // The sales of the period changed after its figures were stored — or they
  // were never stored by the current engine. Shown as a warning with the
  // recalculation action next to it.
  totalesDesactualizados: z.boolean().optional(),
  // The instant the period is prepared to be closed at, or null when no cut is
  // set. Only meaningful while the period is open.
  salesCutoffAt: z.coerce.date().nullable().optional(),
});

/** Where the operator wants the cut to land. */
export const salesCutoffTargetSchema = z.discriminatedUnion("mode", [
  // An explicit instant: a day chip, a tapped sale, or "nothing".
  z.object({ mode: z.literal("at"), cutoffAt: z.coerce.date() }),
  // The server stamps the instant: today's chip, or any target already past now.
  z.object({ mode: z.literal("now") }),
  // "Whole period" and "Remove cut": the period goes back to closing like today.
  z.object({ mode: z.literal("clear") }),
]);
export type ISalesCutoffTarget = z.infer<typeof salesCutoffTargetSchema>;

/** Body of PATCH /api/cierre/[tiendaId]/[cierreId]/sales-cutoff. */
export const setSalesCutoffSchema = z.object({
  target: salesCutoffTargetSchema,
  // The cut the client believed was in force. Two cashiers can have the dialog
  // open at once; without this the last one silently wins and the first never
  // finds out. Same optimistic check the close uses, same 409.
  expectedCutoffAt: z.coerce.date().nullable(),
});
export type ISetSalesCutoff = z.infer<typeof setSalesCutoffSchema>;

/** Response of that same PATCH: the cutoff as it was stored. */
export const salesCutoffResponseSchema = z.object({
  cutoffAt: z.coerce.date().nullable(),
});
export type ISalesCutoffResponse = z.infer<typeof salesCutoffResponseSchema>;

/**
 * The cutoff state of the open period, as the closing screen reads it.
 * deferredTotal is in base currency, net of discounts, tips excluded: the same
 * figure and the same engine the screen's own total de ventas comes from.
 */
export const salesCutoffStateSchema = z.object({
  cutoffAt: z.coerce.date().nullable(),
  // Sales the close TAKES. Zero is a valid choice ("Nada"), and the screen says
  // so in words: without this figure it would have to be guessed from the
  // product and per-cashier lists, which is an inference and not the datum.
  includedCount: z.number().int().nonnegative(),
  deferredCount: z.number().int().nonnegative(),
  deferredTotal: z.number(),
});
export type ISalesCutoffState = z.infer<typeof salesCutoffStateSchema>;

/** Body of PUT /api/cierre/[tiendaId]/[cierreId]/close. */
export const closeCierreSchema = z.object({
  // The cutoff the client had on screen. The server answers 409 when the stored
  // one differs, so the deferral the operator confirmed is the one that happens.
  expectedCutoffAt: z.coerce.date().nullable(),
});
export type ICloseCierreRequest = z.infer<typeof closeCierreSchema>;

const cierrePeriodoRowSchema = cierrePeriodoSchema.omit({ tienda: true });

/** Response of that same PUT. */
export const closeCierreResultSchema = z.object({
  closedPeriod: cierrePeriodoRowSchema,
  // The period the close created, which starts exactly at the cutoff. NULL when
  // there was no cutoff: the client opens the next period itself, as it does today.
  openedPeriod: cierrePeriodoRowSchema.nullable(),
  // Sales actually moved by the updateMany, not the number the computation
  // expected. Zero when there was no cutoff.
  deferredCount: z.number().int().nonnegative(),
  deferredTotal: z.number(),
});
export type ICloseCierreResult = z.infer<typeof closeCierreResultSchema>;

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
  // Always emitted by GET /api/cierre/[tiendaId]/[cierreId]. Optional because
  // the historical view builds an ICierreData of its own.
  salesCutoff: salesCutoffStateSchema.optional(),
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
});

const cierreStoredTotalsSchema = z.object({
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
