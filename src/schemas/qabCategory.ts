import { z } from "zod";

/**
 * PURE. cuadrecaja's `Categoria.color` is a NOT NULL String; the wire's is a
 * nullable field whose OMISSION DELETES the column. The bridge is here and
 * nowhere else: blank (empty or whitespace) means "no colour", i.e. `null`.
 * See ADR 0045.
 *
 *   toQabCategoryColor("#1E88E5") === "#1E88E5"
 *   toQabCategoryColor("")        === null
 *   toQabCategoryColor("   ")     === null
 *   toQabCategoryColor(null)      === null
 *   toQabCategoryColor(undefined) === null
 */
export function toQabCategoryColor(
  color: string | null | undefined,
): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  return trimmed.length === 0 ? null : color;
}

/**
 * `payload` of a CATEGORY event, contract v10.1. STRICT.
 *
 * `color` is REQUIRED and nullable, never optional: on the other side it is
 * written with `color ?? null`, so a key that is not here DELETES the column —
 * the same trap as STORE's nine contact fields. The only safe rule is that it
 * cannot be omitted at all, and that `null` is spelled out.
 *
 * `slug` is NOT a key of this payload: the other side derives it once, at
 * creation, and freezes it. Renaming does not move it.
 */
export const qabCategoryPayloadSchema = z
  .object({
    categoryId: z.string().uuid(),
    businessId: z.string().uuid(),
    name: z.string().min(1),
    color: z.string().nullable(),
    /** ISO 8601 with milliseconds. ANTI-STALE guard: `<=` the stored one writes nothing. */
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabCategoryPayload = z.infer<typeof qabCategoryPayloadSchema>;

/** Flat input of `buildQabCategoryPayload`. */
export const qabCategoryPayloadInputSchema = z
  .object({
    /** The CARRIER business. In a global-category cascade this is the loop variable. */
    negocioId: z.string().uuid(),
    /** `Categoria.id`. Identity on the other side is the pair (token's business, this). */
    categoriaId: z.string().uuid(),
    /** `Categoria.nombre`. */
    nombre: z.string().min(1),
    /** `Categoria.color`, RAW. The builder maps blank to null; this schema does not. */
    color: z.string().nullable(),
    occurredAt: z.date(),
  })
  .strict();
export type IQabCategoryPayloadInput = z.infer<
  typeof qabCategoryPayloadInputSchema
>;
