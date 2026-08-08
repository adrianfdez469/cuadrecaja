import { z } from "zod";
import { reportMetaSchema } from "./common";

export const turnoverStateSchema = z.enum([
  "sin_stock",
  "critico",
  "bajo",
  "saludable",
  "sobrestock",
]);

export const turnoverRowSchema = z.object({
  storeProductId: z.string(),
  nombre: z.string(),
  categoryName: z.string(),
  existenciaActual: z.number(),
  unidadesVendidas: z.number(),
  ventaDiariaPromedio: z.number(),
  diasCobertura: z.number().nullable(),
  valorStock: z.number(),
  rotacion: z.number(),
  estado: turnoverStateSchema,
});

export const deadStockRowSchema = z.object({
  storeProductId: z.string(),
  nombre: z.string(),
  categoryName: z.string(),
  existenciaActual: z.number(),
  capitalInmovilizado: z.number(),
  expiresAt: z.coerce.date().nullable(),
});

export const abcRowSchema = z.object({
  storeProductId: z.string(),
  nombre: z.string(),
  ganancia: z.number(),
  ventasNetas: z.number(),
  gananciaAcumuladaPorcentaje: z.number(),
  clase: z.enum(["A", "B", "C"]),
});

export const expiryBucketSchema = z.object({
  dias: z.number(),
  etiqueta: z.string(),
  productos: z.number(),
  unidades: z.number(),
  valorEnRiesgo: z.number(),
});

export const expiryRiskRowSchema = z.object({
  storeProductId: z.string(),
  nombre: z.string(),
  existenciaActual: z.number(),
  valorEnRiesgo: z.number(),
  expiresAt: z.coerce.date(),
  diasRestantes: z.number(),
});

export const inventoryReportResponseSchema = z.object({
  meta: reportMetaSchema,
  resumen: z.object({
    productosActivos: z.number(),
    valorInventario: z.number(),
    productosCriticos: z.number(),
    productosSobrestock: z.number(),
    capitalInmovilizado: z.number(),
    productosSinMovimiento: z.number(),
    valorEnRiesgoVencimiento: z.number(),
    /** True when the range ended in the past, making coverage figures unreliable. */
    stockDesalineado: z.boolean(),
  }),
  rotacion: z.array(turnoverRowSchema),
  capitalInmovilizado: z.array(deadStockRowSchema),
  abc: z.array(abcRowSchema),
  vencimientos: z.object({
    buckets: z.array(expiryBucketSchema),
    productos: z.array(expiryRiskRowSchema),
  }),
});

export type ITurnoverRow = z.infer<typeof turnoverRowSchema>;
export type IDeadStockRow = z.infer<typeof deadStockRowSchema>;
export type IAbcRow = z.infer<typeof abcRowSchema>;
export type IExpiryBucket = z.infer<typeof expiryBucketSchema>;
export type IExpiryRiskRow = z.infer<typeof expiryRiskRowSchema>;
export type IInventoryReportResponse = z.infer<
  typeof inventoryReportResponseSchema
>;
