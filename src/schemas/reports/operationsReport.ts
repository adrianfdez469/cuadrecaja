import { z } from "zod";
import { reportMetaSchema } from "./common";

export const sellerPerformanceRowSchema = z.object({
  sellerId: z.string(),
  nombre: z.string(),
  ventasNetas: z.number(),
  ventasBrutas: z.number(),
  ganancia: z.number(),
  tickets: z.number(),
  unidades: z.number(),
  ticketPromedio: z.number(),
  unidadesPorTicket: z.number(),
  descuentoOtorgado: z.number(),
  descuentoPorcentaje: z.number(),
  participacionPorcentaje: z.number(),
});

export const paymentMixRowSchema = z.object({
  tipo: z.string(),
  moneda: z.string(),
  montoOriginal: z.number(),
  montoBase: z.number(),
  transacciones: z.number(),
  participacionPorcentaje: z.number(),
  estimado: z.boolean(),
});

export const transferDestinationRowSchema = z.object({
  transferDestinationId: z.string().nullable(),
  nombre: z.string(),
  montoBase: z.number(),
  transacciones: z.number(),
});

export const operationsReportResponseSchema = z.object({
  meta: reportMetaSchema,
  vendedores: z.array(sellerPerformanceRowSchema),
  pagos: z.object({
    mix: z.array(paymentMixRowSchema),
    destinos: z.array(transferDestinationRowSchema),
    totalBase: z.number(),
    ventasEstimadas: z.number(),
  }),
});

export type ISellerPerformanceRow = z.infer<typeof sellerPerformanceRowSchema>;
export type IPaymentMixRow = z.infer<typeof paymentMixRowSchema>;
export type ITransferDestinationRow = z.infer<
  typeof transferDestinationRowSchema
>;
export type IOperationsReportResponse = z.infer<
  typeof operationsReportResponseSchema
>;
