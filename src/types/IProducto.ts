import { ICategory } from "./ICategorias";

export interface IProducto {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: ICategory;
  categoriaId: string;
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