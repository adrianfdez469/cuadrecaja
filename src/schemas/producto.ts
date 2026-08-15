import { z } from "zod";
import { categoriaSchema } from "./categoria";
import { proveedorSchema } from "./proveedor";
import { codigoProductoSchema } from "./codigoProducto";

const fraccionDeSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});

export const productoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, "El nombre es requerido"),
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
  monedaPrecioCode: z.string().nullable().optional(),
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
  monedaCostoCode: z.string().nullable().optional(),
  monedaPrecioCode: z.string().nullable().optional(),
});

// ─── Catálogo del POS ────────────────────────────────────────────────────────

/**
 * The POS catalog payload: only what a cashier's screen actually reads.
 *
 * A shop with 2000 products was downloading and parsing the full
 * `productoTiendaV2` shape for every one of them — supplier records repeated
 * per product, free-text descriptions, and cost figures the POS never shows.
 * On a low-end phone that is megabytes of JSON before a single card is drawn.
 *
 * Costs are deliberately absent, not merely unused: a cashier's device has no
 * business holding the shop's margins.
 */
export const posCategoriaSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  color: z.string(),
});

export const posProveedorSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
});

export const posProductoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  categoria: posCategoriaSchema,
  permiteDecimal: z.boolean().optional(),
  fraccionDeId: z.string().uuid().nullable().optional(),
  unidadesPorFraccion: z.number().int().nullable().optional(),
  codigosProducto: z.array(z.object({ codigo: z.string() })),
});

export const productoTiendaPosSchema = z.object({
  id: z.string().uuid(),
  tiendaId: z.string().uuid(),
  precio: z.number(),
  existencia: z.number(),
  proveedor: posProveedorSchema.nullable().optional(),
  proveedorId: z.string().uuid().nullable().optional(),
  producto: posProductoSchema,
  productoId: z.string().uuid(),
  fechaVencimiento: z.string().nullable().optional(),
  monedaPrecioCode: z.string().nullable().optional(),
});

export type IProductoTiendaPos = z.infer<typeof productoTiendaPosSchema>;
export type IPosCategoria = z.infer<typeof posCategoriaSchema>;

// ─── Info para confirmación de eliminación ───────────────────────────────────

export const productoDeleteStoreInfoSchema = z.object({
  tiendaId: z.string().uuid(),
  tiendaNombre: z.string(),
  existencia: z.number(),
  esConsignacion: z.boolean(),
  proveedorNombre: z.string().nullable().optional(),
  isCurrentTienda: z.boolean().optional(),
  montoPendiente: z.number().nullable().optional(),
});

export const productoDeleteInfoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  stores: z.array(productoDeleteStoreInfoSchema),
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
export type IProdTiendaQueryParams = z.infer<
  typeof prodTiendaQueryParamsSchema
>;
export type IProdTiendaResponse = z.infer<typeof prodTiendaResponseSchema>;
export type IProductoDeleteStoreInfo = z.infer<
  typeof productoDeleteStoreInfoSchema
>;
export type IProductoDeleteInfo = z.infer<typeof productoDeleteInfoSchema>;
