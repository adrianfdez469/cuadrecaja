import { z } from "zod";
import { reportMetaSchema } from "./common";

export const expenseLineSchema = z.object({
  categoria: z.string(),
  naturaleza: z.enum(["OPERATIVO", "INVERSION"]),
  monto: z.number(),
  cantidad: z.number(),
});

export const incomeStatementSchema = z.object({
  ventasBrutas: z.number(),
  descuentos: z.number(),
  ventasNetas: z.number(),
  costoMercanciaVendida: z.number(),
  margenBruto: z.number(),
  margenBrutoPorcentaje: z.number(),
  gastosOperativos: z.number(),
  gastosPorCategoria: z.array(expenseLineSchema),
  gastosInversion: z.number(),
  inversionPorCategoria: z.array(expenseLineSchema),
  merma: z.number(),
  devoluciones: z.number(),
  gananciaFinal: z.number(),
  ajusteConciliacion: z.number(),
});

export const categoryMarginRowSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  categoryColor: z.string().nullable(),
  unidades: z.number(),
  ventasNetas: z.number(),
  costo: z.number(),
  ganancia: z.number(),
  margenPorcentaje: z.number(),
  contribucionPorcentaje: z.number(),
});

export const discountRuleRowSchema = z.object({
  discountRuleId: z.string(),
  nombre: z.string(),
  tipo: z.string().nullable(),
  vecesAplicado: z.number(),
  montoDescontado: z.number(),
  ventasAfectadas: z.number(),
  erosionPorcentaje: z.number(),
});

export const profitabilityReportResponseSchema = z.object({
  meta: reportMetaSchema,
  estadoResultados: incomeStatementSchema,
  categorias: z.array(categoryMarginRowSchema),
  descuentos: z.object({
    reglas: z.array(discountRuleRowSchema),
    totalDescontado: z.number(),
    ventasConDescuento: z.number(),
    /** Discounts with no AppliedDiscount row behind them (legacy sales). */
    sinReglaAsociada: z.number(),
  }),
});

export type IExpenseLine = z.infer<typeof expenseLineSchema>;
export type IIncomeStatement = z.infer<typeof incomeStatementSchema>;
export type ICategoryMarginRow = z.infer<typeof categoryMarginRowSchema>;
export type IDiscountRuleRow = z.infer<typeof discountRuleRowSchema>;
export type IProfitabilityReportResponse = z.infer<
  typeof profitabilityReportResponseSchema
>;
