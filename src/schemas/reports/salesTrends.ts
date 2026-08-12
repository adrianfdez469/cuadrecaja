import { z } from "zod";
import { reportMetaSchema } from "./common";

export const salesTrendPointSchema = z.object({
  bucket: z.string(),
  ventasNetas: z.number(),
  ganancia: z.number(),
  unidades: z.number(),
  transacciones: z.number(),
});

export const trendComparisonSchema = z.object({
  ventasNetas: z.number(),
  ganancia: z.number(),
  transacciones: z.number(),
  /** Operating days behind each window — the fair basis for comparison. */
  diasOperacion: z.number(),
  ventasPorDia: z.number(),
});

export const hourWeekdayCellSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  ventasNetas: z.number(),
  transacciones: z.number(),
});

export const salesTrendsResponseSchema = z.object({
  meta: reportMetaSchema,
  serie: z.array(salesTrendPointSchema),
  actual: trendComparisonSchema,
  anterior: trendComparisonSchema,
  variacion: z.object({
    ventasNetas: z.number(),
    ganancia: z.number(),
    transacciones: z.number(),
    ventasPorDia: z.number(),
  }),
  heatmap: z.object({
    cells: z.array(hourWeekdayCellSchema),
    maxVentas: z.number(),
    pico: z
      .object({
        weekday: z.number(),
        hour: z.number(),
        ventasNetas: z.number(),
      })
      .nullable(),
  }),
});

export type ISalesTrendPoint = z.infer<typeof salesTrendPointSchema>;
export type ITrendComparison = z.infer<typeof trendComparisonSchema>;
export type IHourWeekdayCell = z.infer<typeof hourWeekdayCellSchema>;
export type ISalesTrendsResponse = z.infer<typeof salesTrendsResponseSchema>;
