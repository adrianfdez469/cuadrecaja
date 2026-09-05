import { z } from "zod";

/**
 * Response of the dashboard summary endpoint. Every monetary field is in the
 * business base currency; the UI converts to the selected display currency
 * using current rates.
 */
export const dashboardSummarySchema = z.object({
  ventas: z.object({
    totalPeriodo: z.number(),
    unidadesVendidas: z.number(),
    gananciaTotal: z.number(),
    totalGastos: z.number(),
    totalMerma: z.number(),
    totalDevoluciones: z.number(),
    gananciaFinal: z.number(),
    productosActivos: z.number(),
    /**
     * Sales of the range that landed from an online order, and their net amount
     * in base currency (ADR 0075). The amount is PART of `totalPeriodo`, never a
     * sum on top of it, and the KPI row says so under the figure.
     */
    cantidadVentasTiendaOnline: z.number(),
    totalTiendaOnline: z.number(),
  }),
  topProductos: z.array(z.object({ nombre: z.string(), unidades: z.number() })),
  topGanancias: z.array(z.object({ nombre: z.string(), ganancia: z.number() })),
  productosMenosVendidos: z.array(
    z.object({ nombre: z.string(), unidades: z.number() }),
  ),
  productosMenosRentables: z.array(
    z.object({ nombre: z.string(), rentabilidad: z.number() }),
  ),
});

export type IDashboardSummary = z.infer<typeof dashboardSummarySchema>;
