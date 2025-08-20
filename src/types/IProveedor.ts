// 🆕 Importar tipo de Usuario
export interface IUsuarioBasico {
  id: string;
  nombre: string;
  usuario: string;
}

export interface IProveedor {
  id: string;
  nombre: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  createdAt: Date;
  updatedAt: Date;
  negocioId: string;
  // 🆕 Usuario asociado opcionalimente
  usuarioId?: string;
  usuario?: IUsuarioBasico;
}

export interface IProveedorCreate {
  nombre: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  // 🆕 Usuario asociado opcional
  usuarioId?: string;
}

export interface IProveedorUpdate {
  nombre?: string;
  descripcion?: string;
  direccion?: string;
  telefono?: string;
  // 🆕 Usuario asociado opcional
  usuarioId?: string;
} 