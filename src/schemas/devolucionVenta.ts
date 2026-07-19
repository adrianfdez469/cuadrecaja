import { z } from "zod";

export const ventaBuscadaProductoSchema = z.object({
  ventaProductoId: z.string().uuid(),
  productoTiendaId: z.string().uuid(),
  productoId: z.string().uuid(),
  nombre: z.string(),
  cantidad: z.number(),
  cantidadDevuelta: z.number(),
  cantidadDisponible: z.number(),
  costo: z.number(),
  precio: z.number(),
  monedaCostoCode: z.string().nullable().optional(),
  monedaPrecioCode: z.string().nullable().optional(),
});

export const ventaBuscadaSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  total: z.number(),
  monedaCobro: z.string().optional(),
  usuarioNombre: z.string().optional(),
  productos: z.array(ventaBuscadaProductoSchema),
});

export const buscarVentasResponseSchema = z.object({
  ventas: z.array(ventaBuscadaSchema),
});

export const devolucionVentaCreateSchema = z.object({
  ventaProductoId: z.string().uuid(),
  cantidad: z.number().positive("La cantidad debe ser mayor a 0"),
  motivo: z.string().max(300, "Máximo 300 caracteres").optional(),
});

export type IVentaBuscadaProducto = z.infer<typeof ventaBuscadaProductoSchema>;
export type IVentaBuscada = z.infer<typeof ventaBuscadaSchema>;
export type IBuscarVentasResponse = z.infer<typeof buscarVentasResponseSchema>;
export type IDevolucionVentaCreate = z.infer<
  typeof devolucionVentaCreateSchema
>;
