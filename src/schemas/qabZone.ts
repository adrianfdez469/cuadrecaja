import { z } from "zod";

/** Declared by the shared catalog artifact. NEVER derived from the code's shape. */
export const zoneLevelSchema = z.enum(["FIRST_LEVEL", "MUNICIPALITY"]);
export type IZoneLevel = z.infer<typeof zoneLevelSchema>;

/** One row of the shared zone catalog, verbatim as the artifact publishes it. */
export const zoneCatalogEntrySchema = z.object({
  code: z.string(),
  name: z.string(),
  level: zoneLevelSchema,
  provinceCode: z.string().nullable(),
  osmRelationId: z.string(),
  osmName: z.string(),
  retiredAt: z.string().nullable(),
});
export type IZoneCatalogEntry = z.infer<typeof zoneCatalogEntrySchema>;

export const zoneCatalogSchema = z.object({
  version: z.string(),
  generatedAt: z.string(),
  zones: z.array(zoneCatalogEntrySchema),
});
export type IZoneCatalog = z.infer<typeof zoneCatalogSchema>;

/**
 * The zone a resolution is asked about: only what precedence needs. A catalog
 * entry satisfies it structurally, and so does a synthetic zone that is in no
 * catalog at all.
 */
export const zoneRefSchema = z.object({
  code: z.string(),
  level: zoneLevelSchema,
  provinceCode: z.string().nullable(),
});
export type IZoneRef = z.infer<typeof zoneRefSchema>;

/** A three-valued discriminant, never two booleans. */
export const zoneTariffRuleSchema = z.enum(["FEE", "NOT_SERVED", "INHERIT"]);
export type IZoneTariffRule = z.infer<typeof zoneTariffRuleSchema>;

/**
 * One tariff row as the wire payload shapes it: the amount is a NUMBER here.
 * storeId and updatedAt belong to the event lifecycle, not to resolution.
 */
export const zoneTariffRowSchema = z.object({
  zoneCode: z.string(),
  rule: zoneTariffRuleSchema,
  deliveryFee: z.number().optional(),
});
export type IZoneTariffRow = z.infer<typeof zoneTariffRowSchema>;

/** What one consulted rung said. ABSENT means there was no row for that code. */
export const zoneResolutionVerdictSchema = z.enum([
  "FEE",
  "FEE_WITHOUT_AMOUNT",
  "FEE_NEGATIVE",
  "NOT_SERVED",
  "INHERIT",
  "ABSENT",
]);
export type IZoneResolutionVerdict = z.infer<typeof zoneResolutionVerdictSchema>;

export const zoneResolutionStepSchema = z.object({
  code: z.string(),
  level: zoneLevelSchema,
  verdict: zoneResolutionVerdictSchema,
  decides: z.boolean(),
});
export type IZoneResolutionStep = z.infer<typeof zoneResolutionStepSchema>;

/**
 * The three outputs the agreed vector compares together. deliveryFee is a
 * two-decimal string or null, never a number, and the key is always present.
 */
export const zoneResolutionSchema = z.object({
  served: z.boolean(),
  deliveryFee: z.string().nullable(),
  decidedBy: z.string().nullable(),
  path: z.array(zoneResolutionStepSchema),
});
export type IZoneResolution = z.infer<typeof zoneResolutionSchema>;
