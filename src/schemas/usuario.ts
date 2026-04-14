import { z } from 'zod';

export const usuarioBasicoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  usuario: z.string().min(1),
});

export const usuarioSchema = usuarioBasicoSchema.extend({
  rol: z.string(),
});

export const createUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  usuario: z.string().min(1, 'El usuario es requerido'),
  password: z.string().optional(),
});

export type IUsuarioBasico = z.infer<typeof usuarioBasicoSchema>;
export type IUser = z.infer<typeof usuarioSchema>;
export type IUsuarioPayload = z.infer<typeof createUsuarioSchema>;
