export interface INegocio {
  id: string;
  nombre: string;
  limitTime: Date;
  locallimit: number;
  userlimit: number;
  productlimit: number;
  planId?: string | null;
  /** Negocio creado al activar cuenta desde la landing */
  creadoPorActivacionLanding?: boolean;
}