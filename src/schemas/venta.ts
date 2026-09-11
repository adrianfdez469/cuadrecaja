import { z } from "zod";
import { usuarioSchema } from "./usuario";
import { pagoLineaSchema, tipDetalleSchema, vueltoLineaSchema } from "./pago";
import { tasaSnapshotSchema } from "./tasaCambio";

export const ventaProductoSchema = z.object({
  id: z.string().uuid(),
  ventaProductoId: z.string().uuid().optional(),
  ventaId: z.string().uuid(),
  productoTiendaId: z.string().uuid(),
  cantidad: z.number(),
  name: z.string().optional(),
  price: z.number().optional(),
  // Moneda del precio al momento de la venta (snapshot). null/undefined ⇒ moneda base del negocio.
  monedaPrecioCode: z.string().optional(),
});

export const appliedDiscountSchema = z.object({
  id: z.string().uuid(),
  discountRuleId: z.string().uuid(),
  ventaId: z.string().uuid(),
  amount: z.number(),
  productsAffected: z
    .array(
      z.object({
        productoTiendaId: z.string().uuid(),
        cantidad: z.number(),
      }),
    )
    .optional(),
  createdAt: z.coerce.date(),
  ruleName: z.string().optional(),
});

export const ventaSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  total: z.number(),
  totalcash: z.number(),
  totaltransfer: z.number(),
  discountTotal: z.number().optional(),
  tiendaId: z.string().uuid(),
  usuarioId: z.string().uuid(),
  cierrePeriodoId: z.string().uuid(),
  productos: z.array(ventaProductoSchema).optional(),
  usuario: usuarioSchema.optional(),
  syncId: z.string().optional(),
  frontendCreatedAt: z.coerce.date().optional(),
  wasOffline: z.boolean().optional(),
  syncAttempts: z.number().int().optional(),
  syncAttemptsAreFailures: z.boolean().optional(),
  appliedDiscounts: z.array(appliedDiscountSchema).optional(),
  transferDestinationId: z.string().uuid().optional(),
  transferDestination: z
    .object({ id: z.string(), nombre: z.string() })
    .optional(),
  // Multimoneda — snapshot de la venta al momento de cobrarla
  monedaCobro: z.string().optional(),
  pagosDetalle: z.array(pagoLineaSchema).optional(),
  vueltoDetalle: z.array(vueltoLineaSchema).optional(),
  tasaSnapshot: tasaSnapshotSchema.optional(),
  // Propina — parte de pagosDetalle que no es del negocio. Nunca entra en `total`.
  tipTotal: z.number().optional(),
  tipDetail: tipDetalleSchema.optional(),
});

/**
 * Una línea de venta que la tienda no puede cubrir, tal como la devuelve el
 * servidor al rechazarla.
 *
 * El rechazo se daba antes en una sola frase con el `productoTiendaId` dentro,
 * que no le dice nada a quien está en la caja. Aquí viaja lo que hace falta
 * para actuar: qué producto, cuánto pedía la venta y cuánto había.
 */
export const faltanteExistenciaSchema = z.object({
  productoTiendaId: z.string(),
  nombre: z.string(),
  solicitada: z.number(),
  disponible: z.number(),
});

export type IFaltanteExistencia = z.infer<typeof faltanteExistenciaSchema>;

export type IVenta = z.infer<typeof ventaSchema>;
export type VentaProducto = z.infer<typeof ventaProductoSchema>;
export type AppliedDiscount = z.infer<typeof appliedDiscountSchema>;
