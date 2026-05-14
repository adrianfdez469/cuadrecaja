import { z } from 'zod';

export const tasaSnapshotSchema = z.record(z.string(), z.number().positive());

export const tasaCambioSchema = z.object({
  id: z.string().uuid(),
  negocioId: z.string().uuid(),
  monedaCode: z.string(),
  tasa: z.number().positive(),
  creadoPorId: z.string().uuid(),
  createdAt: z.coerce.date(),
  creadoPor: z.object({ id: z.string().uuid(), nombre: z.string() }).optional(),
});

export const tasaCambioCreateSchema = z.object({
  monedaCode: z.string().min(1),
  tasa: z.number().positive('La tasa debe ser mayor a 0'),
});

export const tasasVigentesSchema = z.object({
  tasas: tasaSnapshotSchema,
  actualizadoEn: z.coerce.date().optional(),
});

export const historialMonedaBaseSchema = z.object({
  id: z.string().uuid(),
  negocioId: z.string().uuid(),
  monedaAnterior: z.string(),
  monedaNueva: z.string(),
  tasaUsada: z.number().positive(),
  creadoPorId: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export const cambiarMonedaBaseSchema = z.object({
  monedaNueva: z.string().min(1),
});

export type ITasaSnapshot = z.infer<typeof tasaSnapshotSchema>;
export type ITasaCambio = z.infer<typeof tasaCambioSchema>;
export type ITasaCambioCreate = z.infer<typeof tasaCambioCreateSchema>;
export type ITasasVigentes = z.infer<typeof tasasVigentesSchema>;
export type IHistorialMonedaBase = z.infer<typeof historialMonedaBaseSchema>;
export type ICambiarMonedaBase = z.infer<typeof cambiarMonedaBaseSchema>;
