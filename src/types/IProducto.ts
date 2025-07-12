import { ICategory } from "./ICategoria";
import { IProveedor } from "./IProveedor";

export interface IProducto {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: ICategory;
  categoriaId: string;

  fraccionDeId?: string;
  unidadesPorFraccion?: number;
  fraccionDe?: Pick<IProducto, "id"|"nombre">;
}

export interface IProductoTienda {
  id: string;
  color: string;
  nombre: string;
  costo: number;
  descripcion: string;
  existencia: number;
  precio: number
  categoriaId: string;
  categoria: ICategory;
  productoTiendaId: string;
  enConsignacion?: boolean;

  fraccionDeId?: string;
  unidadesPorFraccion?: number;
}

export interface IProductoVenta {
  productoTiendaId: string;
  cantidad: number;
  productId: string;
}

export interface IProductoTiendaV2 {
  id: string;
  tiendaId: string;
  costo: number;
  precio: number;
  existencia: number;
  proveedor: IProveedor;
  proveedorId: string;
  producto: IProducto;
  productoId: string;
}