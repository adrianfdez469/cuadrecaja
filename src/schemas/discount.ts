import { z } from 'zod';

export const DiscountTypeEnum = z.enum(['PERCENTAGE', 'FIXED', 'PROMO_CODE']);
export const DiscountAppliesToEnum = z.enum(['TICKET', 'PRODUCT', 'CATEGORY', 'CUSTOMER']);

export const discountRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es requerido'),
  type: DiscountTypeEnum,
  value: z.number(),
  appliesTo: DiscountAppliesToEnum,
  conditions: z.unknown().nullable().optional(),
  startDate: z.union([z.string(), z.date()]).nullable().optional(),
  endDate: z.union([z.string(), z.date()]).nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  createdBy: z.string().nullable().optional(),
  negocioId: z.string().uuid().nullable().optional(),
});

export const createDiscountRuleSchema = discountRuleSchema.omit({ id: true, createdAt: true });
export const updateDiscountRuleSchema = createDiscountRuleSchema.partial();

export type DiscountType = z.infer<typeof DiscountTypeEnum>;
export type DiscountAppliesTo = z.infer<typeof DiscountAppliesToEnum>;
export type IDiscountRule = z.infer<typeof discountRuleSchema>;
export type ICreateDiscountRule = z.infer<typeof createDiscountRuleSchema>;
export type IUpdateDiscountRule = z.infer<typeof updateDiscountRuleSchema>;
