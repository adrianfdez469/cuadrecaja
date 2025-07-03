export interface IProveedor {
  id: string;
  nombre: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  createdAt: Date;
  updatedAt: Date;
  negocioId: string;
}

export interface IProveedorCreate {
  nombre: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
}

export interface IProveedorUpdate {
  nombre?: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
} 