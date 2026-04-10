import { z } from 'zod';

export const resumenDiaProductoSchema = z.object({
  productoTiendaId: z.string().uuid(),
  productoId: z.string().uuid(),
  nombre: z.string(),
  proveedorNombre: z.string().optional(),
  cantidadInicial: z.number(),
  ventas: z.number(),
  entradas: z.number(),
  salidas: z.number(),
  cantidadFinal: z.number(),
});

export const resumenDiaTotalesSchema = z.object({
  ventas: z.number(),
  entradas: z.number(),
  salidas: z.number(),
});

export const resumenDiaResponseSchema = z.object({
  productos: z.array(resumenDiaProductoSchema),
  totales: resumenDiaTotalesSchema,
});

export type IResumenDiaProducto = z.infer<typeof resumenDiaProductoSchema>;
export type IResumenDiaTotales  = z.infer<typeof resumenDiaTotalesSchema>;
export type IResumenDiaResponse = z.infer<typeof resumenDiaResponseSchema>;
