export interface INotificacion {
  id: string;
  titulo: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  nivelImportancia: NivelImportancia;
  tipo: TipoNotificacion;
  leidoPor: string; // Array de userIds separados por coma
  negociosDestino: string; // Array de negocioIds separados por coma
  usuariosDestino: string; // Array de userIds separados por coma
  createdAt: Date;
  updatedAt: Date;
}

export interface INotificacionConEstado extends INotificacion {
  yaLeida: boolean;
}

export type NivelImportancia = 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export type TipoNotificacion = 'ALERTA' | 'NOTIFICACION' | 'PROMOCION' | 'MENSAJE';

export interface INotificacionStats {
  total: number;
  activas: number;
  expiradas: number;
  programadas: number;
  porTipo: {
    ALERTA: number;
    NOTIFICACION: number;
    PROMOCION: number;
    MENSAJE: number;
  };
  porImportancia: {
    BAJA: number;
    MEDIA: number;
    ALTA: number;
    CRITICA: number;
  };
  leidas: number;
  noLeidas: number;
  ultimos30Dias: number;
  porcentajeLeidas: number;
}

export interface INotificacionFormData {
  titulo: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
  nivelImportancia: NivelImportancia;
  tipo: TipoNotificacion;
  negociosDestino: string[];
  usuariosDestino: string[];
}

export interface INotificacionResponse {
  message: string;
  notificacion?: INotificacion;
  error?: string;
}
