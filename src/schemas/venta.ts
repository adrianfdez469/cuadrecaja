import { z } from 'zod';
import { usuarioSchema } from './usuario';

export const ventaProductoSchema = z.object({
  id: z.string().uuid(),
  ventaProductoId: z.string().uuid().optional(),
  ventaId: z.string().uuid(),
  productoTiendaId: z.string().uuid(),
  cantidad: z.number(),
  name: z.string().optional(),
  price: z.number().optional(),
});

export const appliedDiscountSchema = z.object({
  id: z.string().uuid(),
  discountRuleId: z.string().uuid(),
  ventaId: z.string().uuid(),
  amount: z.number(),
  productsAffected: z.array(z.object({
    productoTiendaId: z.string().uuid(),
    cantidad: z.number(),
  })).optional(),
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
  appliedDiscounts: z.array(appliedDiscountSchema).optional(),
  transferDestinationId: z.string().uuid().optional(),
  transferDestination: z.object({ id: z.string(), nombre: z.string() }).optional(),
});

export type IVenta = z.infer<typeof ventaSchema>;
export type VentaProducto = z.infer<typeof ventaProductoSchema>;
export type AppliedDiscount = z.infer<typeof appliedDiscountSchema>;
