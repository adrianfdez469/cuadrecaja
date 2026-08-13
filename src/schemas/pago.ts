import { z } from "zod";
import { tasaSnapshotSchema } from "./tasaCambio";

export const pagoLineaSchema = z.object({
  tipo: z.enum(["cash", "transfer"]),
  moneda: z.string().min(1),
  monto: z.number().positive(),
  equivalenteBase: z.number().nonnegative(),
  transferDestinationId: z.string().uuid().optional(),
});

export const vueltoLineaSchema = z.object({
  moneda: z.string().min(1),
  monto: z.number().nonnegative(),
});

export const pagosDetalleSchema = z.array(pagoLineaSchema);
export const vueltoDetalleSchema = z.array(vueltoLineaSchema);

/**
 * Propina: mismo shape que un pago, porque no es dinero aparte sino la parte
 * de `pagosDetalle` que no pertenece al negocio. Se guarda desglosada por
 * moneda y forma de pago para poder repartirla y reportarla.
 */
export const tipDetalleSchema = z.array(pagoLineaSchema);

/** Validación app: requiere transferDestinationId en líneas transfer con monto > 0 */
export const pagosDetalleAppSchema = pagosDetalleSchema
  .min(1)
  .superRefine((pagos, ctx) => {
    pagos.forEach((p, i) => {
      if (p.tipo === "transfer" && p.monto > 0 && !p.transferDestinationId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "transferDestinationId es requerido para pagos por transferencia",
          path: [i, "transferDestinationId"],
        });
      }
    });
  });

export const resumenMonedaCierreSchema = z.object({
  id: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  monedaCode: z.string(),
  totalEfectivo: z.number(),
  totalTransfer: z.number(),
  equivalenteBase: z.number(),
  tipCash: z.number(),
  tipTransfer: z.number(),
});

export const multimonedaExtrasSchema = z.object({
  monedaCobro: z.string().min(1),
  pagosDetalle: pagosDetalleSchema,
  vueltoDetalle: vueltoDetalleSchema,
  tasaSnapshot: tasaSnapshotSchema,
  discountTotal: z.number().nonnegative().optional(),
  // A diferencia del descuento —que el servidor recalcula desde las reglas—,
  // la propina no es recalculable: es una decisión del cajero y hay que
  // transportarla. El servidor la valida contra el excedente, no la deriva.
  tipTotal: z.number().nonnegative().optional(),
  tipDetail: tipDetalleSchema.optional(),
});

export type IPagoLinea = z.infer<typeof pagoLineaSchema>;
export type IVueltoLinea = z.infer<typeof vueltoLineaSchema>;
export type IPagosDetalle = z.infer<typeof pagosDetalleSchema>;
export type IVueltoDetalle = z.infer<typeof vueltoDetalleSchema>;
export type ITipDetalle = z.infer<typeof tipDetalleSchema>;
export type IResumenMonedaCierre = z.infer<typeof resumenMonedaCierreSchema>;
export type IMultimonedaExtras = z.infer<typeof multimonedaExtrasSchema>;
