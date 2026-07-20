import { z } from "zod";
import { productoSchema } from "./producto";
import { proveedorSchema } from "./proveedor";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const MovimientoTipoEnum = z.enum([
  "COMPRA",
  "VENTA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
  "DESAGREGACION_BAJA",
  "DESAGREGACION_ALTA",
  "CONSIGNACION_ENTRADA",
  "CONSIGNACION_DEVOLUCION",
  "MERMA",
  "DEVOLUCION_VENTA",
]);

export const MovimientoStateEnum = z.enum([
  "PENDIENTE",
  "APROBADO",
  "RECHAZADO",
]);

// Tipos creables a través del endpoint genérico POST /api/movimiento.
// VENTA, DESAGREGACION_* y DEVOLUCION_VENTA quedan fuera: se crean por sus
// propios flujos dedicados (venta, desagregación automática, y
// /api/venta/[tiendaId]/devolucion/[ventaId] respectivamente), que calculan
// los montos en el servidor en vez de confiar en el cliente.
export const MovimientoTipoCreableEnum = z.enum([
  "COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
  "CONSIGNACION_ENTRADA",
  "CONSIGNACION_DEVOLUCION",
  "MERMA",
]);

// Fuente de fondos de una compra de mercancía (solo aplica a tipo COMPRA)
// MIXTO: la compra superó el efectivo disponible en caja — se tomó lo
// disponible (ver montoEfectivoCaja) y el resto se cubrió con fondeo externo.
export const FormaPagoCompraEnum = z.enum([
  "EFECTIVO_CAJA",
  "EXTERNO",
  "MIXTO",
]);

// Aviso devuelto al crear una COMPRA en EFECTIVO_CAJA cuyo monto superó el
// efectivo disponible en caja — el backend la reclasificó como MIXTO/EXTERNO.
export const advertenciaCajaInsuficienteSchema = z.object({
  moneda: z.string(),
  solicitado: z.number(),
  disponible: z.number(),
  tomadoDeCaja: z.number(),
  fondeoExterno: z.number(),
});

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
  formaPago: FormaPagoCompraEnum.optional(),
  montoReembolso: z.number().optional(),
  productoTienda: z.object({
    id: z.string().uuid(),
    costo: z.number(),
    precio: z.number(),
    existencia: z.number(),
    producto: productoSchema,
    proveedor: proveedorSchema.optional(),
  }),
  usuario: z
    .object({
      id: z.string().uuid(),
      nombre: z.string(),
    })
    .optional(),
});

export const movimientoCreateSchema = z.object({
  productoId: z.string().uuid(),
  cantidad: z.number().positive().finite(),
  costoUnitario: z.number().nonnegative().finite().optional(),
  costoTotal: z.number().nonnegative().finite().optional(),
  monedaCompra: z.string().optional(),
  proveedorId: z.string().uuid().optional(),
  movimientoOrigenId: z.string().uuid().optional(),
  fechaVencimiento: z.coerce.date().optional(),
  monedaOriginal: z.string().optional(),
  montoOriginal: z.number().nonnegative().finite().optional(),
  tasaUsada: z.number().positive().finite().optional(),
  // Solo DEVOLUCION_VENTA: monto reembolsado al cliente, en moneda base
  montoReembolso: z.number().nonnegative().finite().optional(),
});

export const movimientoDataSchema = z.object({
  // usuarioId NO se acepta del cliente: el endpoint lo fuerza desde la sesión
  tipo: MovimientoTipoCreableEnum,
  tiendaId: z.string().uuid(),
  referenciaId: z.string().optional(),
  motivo: z.string().max(300).optional(),
  proveedorId: z.string().uuid().optional(),
  destinationId: z.string().uuid().optional(),
  // Solo COMPRA: de dónde salió el dinero
  formaPago: FormaPagoCompraEnum.optional(),
});

export const movimientoBatchCreateSchema = z.object({
  data: movimientoDataSchema,
  items: z.array(movimientoCreateSchema).min(1),
});

export const importDataSchema = z.object({
  usuarioId: z.string().uuid(),
  negocioId: z.string().uuid(),
  localId: z.string().uuid(),
});

export const importarItemsMovSchema = z.object({
  nombreProducto: z.string().min(1),
  categoria: z.string().optional(),
  costo: z.number(),
  precio: z.number(),
  cantidad: z.number(),
  esConsignación: z.boolean().optional(),
  nombreProveedor: z.string().optional(),
  monedaCostoCode: z.string().optional(),
  monedaPrecioCode: z.string().optional(),
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
  COMPRA = "COMPRA",
  VENTA = "VENTA",
  TRASPASO_ENTRADA = "TRASPASO_ENTRADA",
  TRASPASO_SALIDA = "TRASPASO_SALIDA",
  AJUSTE_SALIDA = "AJUSTE_SALIDA",
  AJUSTE_ENTRADA = "AJUSTE_ENTRADA",
  DESAGREGACION_BAJA = "DESAGREGACION_BAJA",
  DESAGREGACION_ALTA = "DESAGREGACION_ALTA",
  CONSIGNACION_ENTRADA = "CONSIGNACION_ENTRADA",
  CONSIGNACION_DEVOLUCION = "CONSIGNACION_DEVOLUCION",
  MERMA = "MERMA",
  DEVOLUCION_VENTA = "DEVOLUCION_VENTA",
}

export type ITipoMovimiento = z.infer<typeof MovimientoTipoEnum>;
export type IFormaPagoCompra = z.infer<typeof FormaPagoCompraEnum>;
export type IAdvertenciaCajaInsuficiente = z.infer<
  typeof advertenciaCajaInsuficienteSchema
>;
export type IMovimiento = z.infer<typeof movimientoSchema>;
export type IMovimientoCreate = z.infer<typeof movimientoCreateSchema>;
export type IMovimientoData = z.infer<typeof movimientoDataSchema>;
export type IMovimientoBatchCreate = z.infer<
  typeof movimientoBatchCreateSchema
>;
export type IImportData = z.infer<typeof importDataSchema>;
export type IImportarItemsMov = z.infer<typeof importarItemsMovSchema>;
export type IImportarResponse = z.infer<typeof importarResponseSchema>;
export type IMovimientoProductoEnviado = z.infer<
  typeof movimientoProductoEnviadoSchema
>;
