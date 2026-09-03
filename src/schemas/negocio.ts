import { z } from 'zod';

export const negocioSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  limitTime: z.coerce.date(),
  locallimit: z.number().int(),
  userlimit: z.number().int(),
  productlimit: z.number().int(),
  planId: z.string().uuid().nullable().optional(),
  monedaBase: z.string().optional(),
  monedaFuerte: z.string().optional(),
  creadoPorActivacionLanding: z.boolean().optional(),
});

export type INegocio = z.infer<typeof negocioSchema>;

/** Exactly what the platform-administration endpoints return for a Negocio. */
export const negocioAdminViewSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
    createdAt: z.coerce.date(),
    limitTime: z.coerce.date(),
    planId: z.string().uuid().nullable(),
    suspended: z.boolean(),
    suspendedAt: z.coerce.date().nullable(),
    creadoPorActivacionLanding: z.boolean(),
    monedaBase: z.string(),
    monedaFuerte: z.string(),
  })
  .strict();

export type INegocioAdminView = z.infer<typeof negocioAdminViewSchema>;
