import { z } from 'zod';
import { categoriaSchema } from './categoria';
import { proveedorSchema } from './proveedor';
import { codigoProductoSchema } from './codigoProducto';

const fraccionDeSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});

export const productoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string(),
  categoriaId: z.string().uuid(),
  categoria: categoriaSchema,
  permiteDecimal: z.boolean().optional(),
  fraccionDeId: z.string().uuid().nullable().optional(),
  unidadesPorFraccion: z.number().int().nullable().optional(),
  fraccionDe: fraccionDeSchema.optional(),
  codigosProducto: z.array(codigoProductoSchema),
});

export const productoTiendaSchema = z.object({
  id: z.string().uuid(),
  color: z.string(),
  nombre: z.string(),
  descripcion: z.string(),
  costo: z.number(),
  existencia: z.number(),
  precio: z.number(),
  categoriaId: z.string().uuid(),
  categoria: categoriaSchema,
  productoTiendaId: z.string().uuid(),
  enConsignacion: z.boolean().optional(),
  proveedor: proveedorSchema.optional(),
  permiteDecimal: z.boolean().optional(),
  fraccionDeId: z.string().uuid().nullable().optional(),
  unidadesPorFraccion: z.number().int().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
});

export const productoVentaSchema = z.object({
  productoTiendaId: z.string().uuid(),
  cantidad: z.number(),
  productId: z.string().uuid(),
  price: z.number(),
});

export const productoTiendaV2Schema = z.object({
  id: z.string().uuid(),
  tiendaId: z.string().uuid(),
  costo: z.number(),
  precio: z.number(),
  existencia: z.number(),
  proveedor: proveedorSchema,
  proveedorId: z.string().uuid(),
  producto: productoSchema,
  productoId: z.string().uuid(),
  fechaVencimiento: z.string().nullable().optional(),
});

// ─── Query params / response para movimiento service ────────────────────────

export const prodTiendaQueryParamsSchema = z.object({
  text: z.string().optional(),
  categoriaId: z.string().uuid().optional(),
  take: z.number().int(),
  skip: z.number().int(),
});

export const prodTiendaResponseSchema = productoSchema.extend({
  productosTienda: z.array(productoTiendaV2Schema).optional(),
});

export type IProducto = z.infer<typeof productoSchema>;
export type IProductoTienda = z.infer<typeof productoTiendaSchema>;
export type IProductoVenta = z.infer<typeof productoVentaSchema>;
export type IProductoTiendaV2 = z.infer<typeof productoTiendaV2Schema>;
export type IProdTiendaQueryParams = z.infer<typeof prodTiendaQueryParamsSchema>;
export type IProdTiendaResponse = z.infer<typeof prodTiendaResponseSchema>;
