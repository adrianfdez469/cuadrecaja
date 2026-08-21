import { z } from 'zod';
import { usuarioBasicoSchema } from './usuario';

export const proveedorSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  negocioId: z.string().uuid(),
  usuarioId: z.string().uuid().nullable().optional(),
  usuario: usuarioBasicoSchema.optional(),
});

export const createProveedorSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  usuarioId: z.string().uuid().optional(),
});

export const updateProveedorSchema = createProveedorSchema.partial();

export const proveedorConsignacionSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  telefono: z.string(),
  direccion: z.string(),
  dineroLiquidado: z.number(),
  dineroPorLiquidar: z.number(),
  totalProductosConsignacion: z.number(),
  ultimaLiquidacion: z.string().nullable(),
  estado: z.enum(['activo', 'inactivo']),
});

// One row of the supplier detail screen: current consignment stock joined with
// what has already been sold for that product across closed periods.
export const productoConsignacionSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  categoria: z.string(),
  precio: z.number(),
  vendidos: z.number(),
  disponibles: z.number(),
  ganancias: z.number(),
});

// A supplier settlement, aggregated per closing period.
export const liquidacionConsignacionSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  monto: z.number(),
  productos: z.number(),
  observaciones: z.string(),
  estado: z.enum(['completada', 'pendiente']),
  fechaLiquidacion: z.string().nullable().optional(),
});

export type IProveedor = z.infer<typeof proveedorSchema>;
export type IProveedorCreate = z.infer<typeof createProveedorSchema>;
export type IProveedorUpdate = z.infer<typeof updateProveedorSchema>;
export type IProveedorConsignacion = z.infer<typeof proveedorConsignacionSchema>;
export type IProductoConsignacion = z.infer<typeof productoConsignacionSchema>;
export type ILiquidacionConsignacion = z.infer<typeof liquidacionConsignacionSchema>;
