import {
  qabCategoryPayloadSchema,
  toQabCategoryColor,
} from "@/schemas/qabCategory";
import type {
  IQabCategoryPayload,
  IQabCategoryPayloadInput,
} from "@/schemas/qabCategory";

/**
 * PURE. `color` goes through `toQabCategoryColor`, so a blank colour travels as
 * an explicit `null`. The key is ALWAYS present: omitting it would delete the
 * column just the same, and an explicit null says what was meant.
 * Throws `ZodError` when the row cannot produce a valid payload (an empty name).
 *
 * `businessId` comes from `input.negocioId` — the CARRIER, which in a
 * global-category cascade is the loop variable of `planQabCategoryCascade` and
 * never a value captured once outside it.
 */
export function buildQabCategoryPayload(
  input: IQabCategoryPayloadInput,
): IQabCategoryPayload {
  return qabCategoryPayloadSchema.parse({
    categoryId: input.categoriaId,
    businessId: input.negocioId,
    name: input.nombre,
    color: toQabCategoryColor(input.color),
    updatedAt: input.occurredAt.toISOString(),
  });
}
