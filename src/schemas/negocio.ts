import { z } from 'zod';

export const negocioSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  limitTime: z.coerce.date(),
  locallimit: z.number().int(),
  userlimit: z.number().int(),
  productlimit: z.number().int(),
  planId: z.string().uuid().nullable().optional(),
  creadoPorActivacionLanding: z.boolean().optional(),
});

export type INegocio = z.infer<typeof negocioSchema>;
