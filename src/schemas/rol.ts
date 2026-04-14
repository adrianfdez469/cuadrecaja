import { z } from 'zod';

export const rolSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().nullable().optional(),
  permisos: z.string(),
  negocioId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createRolSchema = rolSchema.omit({ id: true, negocioId: true, createdAt: true, updatedAt: true });
export const updateRolSchema = createRolSchema.partial();

export const permisoSchema = z.object({
  descripcion: z.string(),
});

export type IRol = z.infer<typeof rolSchema>;
export type ICreateRol = z.infer<typeof createRolSchema>;
export type IUpdateRol = z.infer<typeof updateRolSchema>;
export type IPermiso = z.infer<typeof permisoSchema>;
