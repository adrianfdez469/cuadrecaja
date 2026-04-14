import { z } from 'zod';
import { tiendaSchema } from './tienda';

export const cierrePeriodoSchema = z.object({
  id: z.string().uuid(),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date().optional(),
  tiendaId: z.string().uuid(),
  tienda: tiendaSchema,
  totalVentas: z.number(),
  totalGanancia: z.number(),
  totalInversion: z.number(),
  totalTransferencia: z.number(),
  totalVentasPropias: z.number().optional(),
  totalVentasConsignacion: z.number().optional(),
  totalGananciasPropias: z.number().optional(),
  totalGananciasConsignacion: z.number().optional(),
  totalGastos: z.number().optional(),
  totalGananciaFinal: z.number().optional(),
});

const cierreProductoVendidosSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string(),
  costo: z.number(),
  precio: z.number(),
  cantidad: z.number(),
  total: z.number(),
  ganancia: z.number(),
  descuento: z.number().optional(),
  proveedor: z.object({ id: z.string(), nombre: z.string() }).optional(),
  productoId: z.string().uuid(),
});

export const cierreDataSchema = z.object({
  productosVendidos: z.array(cierreProductoVendidosSchema),
  totalVentas: z.number(),
  totalVentasBrutas: z.number().optional(),
  totalDescuentos: z.number().optional(),
  totalGanancia: z.number(),
  totalTransferencia: z.number(),
  totalVentasPropias: z.number().optional(),
  totalVentasConsignacion: z.number().optional(),
  totalGananciasPropias: z.number().optional(),
  totalGananciasConsignacion: z.number().optional(),
  totalTransferenciasByDestination: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    total: z.number(),
  })).optional(),
  totalVentasPorUsuario: z.array(z.object({
    id: z.string(),
    nombre: z.string(),
    total: z.number(),
  })),
});

export const summaryCierreSchema = z.object({
  cierres: z.array(
    cierrePeriodoSchema.omit({ tienda: true }).extend({
      totalVentasBrutas: z.number().optional(),
      totalDescuentos: z.number().optional(),
    })
  ),
  sumTotalGanancia: z.number(),
  sumTotalInversion: z.number(),
  sumTotalVentas: z.number(),
  sumTotalTransferencia: z.number(),
  totalItems: z.number(),
  sumTotalVentasPropias: z.number().optional(),
  sumTotalVentasConsignacion: z.number().optional(),
  sumTotalGananciasPropias: z.number().optional(),
  sumTotalGananciasConsignacion: z.number().optional(),
  desgloseTransferencias: z.array(z.object({
    destinationName: z.string(),
    transferDestinationId: z.string(),
    _sum: z.object({ totaltransfer: z.number() }),
  })).optional(),
  sumTotalVentasBrutas: z.number().optional(),
  sumTotalDescuentos: z.number().optional(),
  sumTotalGastos: z.number().optional(),
  sumTotalGananciaFinal: z.number().optional(),
});

export type ICierrePeriodo = z.infer<typeof cierrePeriodoSchema>;
export type ICierreData = z.infer<typeof cierreDataSchema>;
export type ISummaryCierre = z.infer<typeof summaryCierreSchema>;
