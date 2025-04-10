import { ICategory } from "./ICategoria";

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
}