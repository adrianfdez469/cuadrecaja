import { z } from 'zod';
import { usuarioSchema } from './usuario';
import { rolSchema } from './rol';

export const TipoLocalEnum = z.enum(['TIENDA', 'ALMACEN']);

/** Backward-compatible TypeScript enum (consumed as TipoLocal.TIENDA etc.) */
export enum TipoLocal {
  TIENDA = 'TIENDA',
  ALMACEN = 'ALMACEN',
}

export const usuarioTiendaSchema = z.object({
  id: z.string().uuid(),
  usuarioId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  rolId: z.string().uuid().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  usuario: usuarioSchema,
  rol: rolSchema.optional(),
});

export const tiendaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  negocioId: z.string().uuid(),
  tipo: z.string(),
  usuarios: z.array(usuarioSchema).optional(),
  usuariosTiendas: z.array(usuarioTiendaSchema).optional(),
});

export const createTiendaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo: z.string(),
  usuariosRoles: z.array(z.object({
    usuarioId: z.string().uuid(),
    rolId: z.string().uuid().optional(),
  })).optional(),
});

export const updateTiendaSchema = createTiendaSchema.partial();

// TipoLocal type is provided by the TypeScript enum above
export type IUsuarioTienda = z.infer<typeof usuarioTiendaSchema>;
export type ILocal = z.infer<typeof tiendaSchema>;
export type ILocalPayload = z.infer<typeof createTiendaSchema>;
