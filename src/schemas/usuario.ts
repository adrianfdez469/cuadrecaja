import { z } from 'zod';
import { UsuarioEstadoCuenta } from '@prisma/client';

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

export const usuarioListItemSchema = usuarioBasicoSchema.extend({
  estadoCuenta: z.nativeEnum(UsuarioEstadoCuenta),
  rol: z.string().nullable().optional(),
  negocioId: z.string().optional(),
  localActualId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type IUsuarioBasico = z.infer<typeof usuarioBasicoSchema>;
export type IUser = z.infer<typeof usuarioSchema>;
export type IUsuarioPayload = z.infer<typeof createUsuarioSchema>;
export type IUsuarioListItem = z.infer<typeof usuarioListItemSchema>;
