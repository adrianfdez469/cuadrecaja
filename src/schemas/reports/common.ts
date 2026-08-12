import { z } from "zod";

/**
 * Time window presets shared by every report. Mirrors the values the dashboard
 * already sends, so the existing filter UI keeps working unchanged.
 */
export const reportPeriodSchema = z.enum([
  "dia",
  "semana",
  "mes",
  "anio",
  "personalizado",
]);

export const reportBucketingSchema = z.enum(["day", "week", "month"]);

export const dateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

/**
 * Provenance of the numbers in a report response. Every endpoint must return
 * this: reports are scoped to *closed* periods, so the window the user asked
 * for and the data actually included rarely match exactly. Surfacing the gap is
 * what keeps the figures trustworthy.
 */
export const reportMetaSchema = z.object({
  tiendaId: z.string(),
  /** Every monetary amount in the response is expressed in this currency. */
  monedaBase: z.string(),
  from: z.coerce.date(),
  to: z.coerce.date(),
  previousFrom: z.coerce.date().nullable(),
  previousTo: z.coerce.date().nullable(),
  bucketing: reportBucketingSchema,
  closingPeriodsIncluded: z.object({
    count: z.number().int().nonnegative(),
    from: z.coerce.date().nullable(),
    to: z.coerce.date().nullable(),
    /** Days actually covered by the included closings — the fair denominator. */
    operatingDays: z.number().nonnegative(),
  }),
  salesScanned: z.number().int().nonnegative(),
  linesScanned: z.number().int().nonnegative(),
  /** Sales lacking tasaSnapshot: their foreign-currency lines fell back to rate 1. */
  salesWithoutRates: z.number().int().nonnegative(),
  /** Lines whose ProductoTienda no longer resolves (hard-deleted). */
  unknownProducts: z.number().int().nonnegative(),
  /** True when the scan hit maxSales and stopped early. */
  truncated: z.boolean(),
  generatedAt: z.coerce.date(),
});

export type IReportPeriod = z.infer<typeof reportPeriodSchema>;
export type IReportBucketing = z.infer<typeof reportBucketingSchema>;
export type IDateRange = z.infer<typeof dateRangeSchema>;
export type IReportMeta = z.infer<typeof reportMetaSchema>;
