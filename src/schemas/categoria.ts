import { z } from 'zod';

export const categoriaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  color: z.string().min(1, 'El color es requerido'),
  esGlobal: z.boolean().default(false),
  negocioId: z.string().nullable().optional(),
});

export const createCategoriaSchema = categoriaSchema.omit({ id: true });
export const updateCategoriaSchema = createCategoriaSchema.partial();

export type ICategory = z.infer<typeof categoriaSchema>;
export type ICreateCategoria = z.infer<typeof createCategoriaSchema>;
export type IUpdateCategoria = z.infer<typeof updateCategoriaSchema>;
