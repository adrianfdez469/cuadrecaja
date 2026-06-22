import { z } from 'zod';

export const pagoLineaSchema = z.object({
  tipo: z.enum(['cash', 'transfer']),
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

/** Validación app: requiere transferDestinationId en líneas transfer con monto > 0 */
export const pagosDetalleAppSchema = pagosDetalleSchema.min(1).superRefine(
  (pagos, ctx) => {
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
  },
);

export const resumenMonedaCierreSchema = z.object({
  id: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  monedaCode: z.string(),
  totalEfectivo: z.number(),
  totalTransfer: z.number(),
  equivalenteBase: z.number(),
});

export type IPagoLinea = z.infer<typeof pagoLineaSchema>;
export type IVueltoLinea = z.infer<typeof vueltoLineaSchema>;
export type IPagosDetalle = z.infer<typeof pagosDetalleSchema>;
export type IVueltoDetalle = z.infer<typeof vueltoDetalleSchema>;
export type IResumenMonedaCierre = z.infer<typeof resumenMonedaCierreSchema>;
