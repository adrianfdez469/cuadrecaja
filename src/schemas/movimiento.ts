import { z } from 'zod';
import { productoSchema } from './producto';
import { proveedorSchema } from './proveedor';

// ─── Enums ───────────────────────────────────────────────────────────────────

export const MovimientoTipoEnum = z.enum([
  'COMPRA',
  'VENTA',
  'AJUSTE_ENTRADA',
  'AJUSTE_SALIDA',
  'TRASPASO_ENTRADA',
  'TRASPASO_SALIDA',
  'DESAGREGACION_BAJA',
  'DESAGREGACION_ALTA',
  'CONSIGNACION_ENTRADA',
  'CONSIGNACION_DEVOLUCION',
]);

export const MovimientoStateEnum = z.enum(['PENDIENTE', 'APROBADO', 'RECHAZADO']);

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const movimientoSchema = z.object({
  id: z.string().uuid(),
  fecha: z.coerce.date(),
  tipo: MovimientoTipoEnum,
  cantidad: z.number(),
  motivo: z.string().optional(),
  costoUnitario: z.number().optional(),
  costoTotal: z.number().optional(),
  costoAnterior: z.number().optional(),
  costoNuevo: z.number().optional(),
  existenciaAnterior: z.number().optional(),
  productoTienda: z.object({
    id: z.string().uuid(),
    costo: z.number(),
    precio: z.number(),
    existencia: z.number(),
    producto: productoSchema,
    proveedor: proveedorSchema.optional(),
  }),
  usuario: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }).optional(),
});

export const movimientoCreateSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number(),
  costoUnitario: z.number().optional(),
  costoTotal: z.number().optional(),
});

export const movimientoDataSchema = z.object({
  tipo: MovimientoTipoEnum,
  tiendaId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  referenciaId: z.string().optional(),
  motivo: z.string().optional(),
  proveedorId: z.string().uuid().optional(),
});

export const importDataSchema = z.object({
  usuarioId: z.string().uuid(),
  negocioId: z.string().uuid(),
  localId: z.string().uuid(),
});

export const importarItemsMovSchema = z.object({
  nombreProducto: z.string().min(1),
  costo: z.number(),
  precio: z.number(),
  cantidad: z.number(),
  esConsignación: z.boolean().optional(),
  nombreProveedor: z.string().optional(),
});

export const importarResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  errorCause: z.string().optional(),
  data: z.array(z.unknown()).optional(),
});

export const movimientoProductoEnviadoSchema = z.object({
  id: z.string().uuid(),
  productoTiendaId: z.string().uuid(),
  tipo: z.string(),
  cantidad: z.number(),
  motivo: z.string().nullable(),
  referenciaId: z.string().nullable(),
  fecha: z.coerce.date(),
  existenciaAnterior: z.number(),
  costoUnitario: z.number().nullable(),
  costoTotal: z.number().nullable(),
  costoAnterior: z.number().nullable(),
  costoNuevo: z.number().nullable(),
  usuarioId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  proveedorId: z.string().uuid().nullable(),
  destinationId: z.string(),
  productoTienda: z.object({
    id: z.string().uuid(),
    tiendaId: z.string().uuid(),
    productoId: z.string().uuid(),
    costo: z.number(),
    precio: z.number(),
    existencia: z.number(),
    proveedorId: z.string().uuid().nullable(),
    producto: productoSchema,
    tienda: z.object({
      id: z.string().uuid(),
      nombre: z.string(),
      tipo: z.string(),
    }),
    proveedor: proveedorSchema.nullable(),
  }),
  usuario: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
  }),
});

// ─── Tipos derivados ──────────────────────────────────────────────────────────

/** Backward-compatible TypeScript enum (consumed by enum syntax in UI code) */
export enum MovimientoTipo {
  COMPRA = 'COMPRA',
  VENTA = 'VENTA',
  TRASPASO_ENTRADA = 'TRASPASO_ENTRADA',
  TRASPASO_SALIDA = 'TRASPASO_SALIDA',
  AJUSTE_SALIDA = 'AJUSTE_SALIDA',
  AJUSTE_ENTRADA = 'AJUSTE_ENTRADA',
  DESAGREGACION_BAJA = 'DESAGREGACION_BAJA',
  DESAGREGACION_ALTA = 'DESAGREGACION_ALTA',
  CONSIGNACION_ENTRADA = 'CONSIGNACION_ENTRADA',
  CONSIGNACION_DEVOLUCION = 'CONSIGNACION_DEVOLUCION',
}

export type ITipoMovimiento = z.infer<typeof MovimientoTipoEnum>;
export type IMovimiento = z.infer<typeof movimientoSchema>;
export type IMovimientoCreate = z.infer<typeof movimientoCreateSchema>;
export type IMovimientoData = z.infer<typeof movimientoDataSchema>;
export type IImportData = z.infer<typeof importDataSchema>;
export type IImportarItemsMov = z.infer<typeof importarItemsMovSchema>;
export type IImportarResponse = z.infer<typeof importarResponseSchema>;
export type IMovimientoProductoEnviado = z.infer<typeof movimientoProductoEnviadoSchema>;
