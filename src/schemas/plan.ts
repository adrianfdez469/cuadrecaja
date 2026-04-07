import { z } from 'zod';

export const planSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
  descripcion: z.string().nullable().optional(),
  limiteLocales: z.number().int().min(-1, 'Mínimo -1 (ilimitado)'),
  limiteUsuarios: z.number().int().min(-1, 'Mínimo -1 (ilimitado)'),
  limiteProductos: z.number().int().min(-1, 'Mínimo -1 (ilimitado)'),
  precio: z.number().min(-1, 'Mínimo -1 (negociable)'),
  moneda: z.string().default('USD'),
  duracion: z.number().int().min(-1, 'Mínimo -1 (negociable)'),
  recomendado: z.boolean().default(false),
  color: z.string().min(1, 'El color es requerido'),
  activo: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const createPlanSchema = planSchema.omit({ id: true, createdAt: true, updatedAt: true });

export const updatePlanSchema = createPlanSchema.partial();

export type IPlan = z.infer<typeof planSchema>;
export type ICreatePlan = z.input<typeof createPlanSchema>;
export type IUpdatePlan = z.input<typeof updatePlanSchema>;
