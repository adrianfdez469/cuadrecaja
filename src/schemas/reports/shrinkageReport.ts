import { z } from "zod";
import { reportMetaSchema } from "./common";

export const shrinkageProductRowSchema = z.object({
  storeProductId: z.string(),
  nombre: z.string(),
  categoryName: z.string(),
  merma: z.object({
    unidades: z.number(),
    costo: z.number(),
    movimientos: z.number(),
  }),
  devoluciones: z.object({
    unidades: z.number(),
    perdida: z.number(),
    movimientos: z.number(),
  }),
  perdidaTotal: z.number(),
});

export const shrinkageReasonRowSchema = z.object({
  motivo: z.string(),
  movimientos: z.number(),
  unidades: z.number(),
  perdida: z.number(),
});

export const shrinkageReportResponseSchema = z.object({
  meta: reportMetaSchema,
  productos: z.array(shrinkageProductRowSchema),
  motivos: z.array(shrinkageReasonRowSchema),
  totalMerma: z.number(),
  totalDevoluciones: z.number(),
  perdidaTotal: z.number(),
  /**
   * Window actually scanned. Stock movements carry no closing reference, so it
   * is narrowed to the span the included closings cover rather than the raw
   * requested range.
   */
  ventana: z.object({ from: z.coerce.date(), to: z.coerce.date() }),
});

export type IShrinkageProductRow = z.infer<typeof shrinkageProductRowSchema>;
export type IShrinkageReasonRow = z.infer<typeof shrinkageReasonRowSchema>;
export type IShrinkageReportResponse = z.infer<
  typeof shrinkageReportResponseSchema
>;
