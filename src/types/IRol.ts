export interface IRol {
  id: string;
  nombre: string;
  descripcion: string | null;
  permisos: string;
  negocioId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ICreateRol {
  nombre: string;
  descripcion?: string;
  permisos: string;
}

export interface IUpdateRol {
  nombre?: string;
  descripcion?: string;
  permisos?: string;
}

export interface IPermiso {
  descripcion: string;
} 