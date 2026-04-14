import { z } from 'zod';

export const NivelImportanciaEnum = z.enum(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']);
export const TipoNotificacionEnum = z.enum(['ALERTA', 'NOTIFICACION', 'PROMOCION', 'MENSAJE']);

export const notificacionSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(1, 'El título es requerido'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
  nivelImportancia: NivelImportanciaEnum,
  tipo: TipoNotificacionEnum,
  leidoPor: z.string(),
  negociosDestino: z.string(),
  usuariosDestino: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const notificacionConEstadoSchema = notificacionSchema.extend({
  yaLeida: z.boolean(),
});

export const notificacionStatsSchema = z.object({
  total: z.number(),
  activas: z.number(),
  expiradas: z.number(),
  programadas: z.number(),
  porTipo: z.object({
    ALERTA: z.number(),
    NOTIFICACION: z.number(),
    PROMOCION: z.number(),
    MENSAJE: z.number(),
  }),
  porImportancia: z.object({
    BAJA: z.number(),
    MEDIA: z.number(),
    ALTA: z.number(),
    CRITICA: z.number(),
  }),
  leidas: z.number(),
  noLeidas: z.number(),
  ultimos30Dias: z.number(),
  porcentajeLeidas: z.number(),
});

export const notificacionFormDataSchema = z.object({
  titulo: z.string().min(1, 'El título es requerido'),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  nivelImportancia: NivelImportanciaEnum,
  tipo: TipoNotificacionEnum,
  negociosDestino: z.array(z.string()),
  usuariosDestino: z.array(z.string()),
});

export const notificacionResponseSchema = z.object({
  message: z.string(),
  notificacion: notificacionSchema.optional(),
  error: z.string().optional(),
});

export type INotificacion = z.infer<typeof notificacionSchema>;
export type INotificacionConEstado = z.infer<typeof notificacionConEstadoSchema>;
export type INotificacionStats = z.infer<typeof notificacionStatsSchema>;
export type INotificacionFormData = z.infer<typeof notificacionFormDataSchema>;
export type INotificacionResponse = z.infer<typeof notificacionResponseSchema>;
export type NivelImportancia = z.infer<typeof NivelImportanciaEnum>;
export type TipoNotificacion = z.infer<typeof TipoNotificacionEnum>;
