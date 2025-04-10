
// COMPRA: Movimientos de compras de producto. La cantidad es positiva. Cuando se compra un producto.
// VENTA:  Movimientos de ventas de producto. La cantidad es negativa. Cada vez que se realiza la venta de un producto.
// AJUSTE_ENTRADA: Movimiento de ajuste por motivo de sobrenates etc.
// AJUSTE_SALIDA: Movimiento de ajuste por motivo de faltantes.
// TRASPASO_ENTRADA: Cuando se realiza un traspaso de una tienda a otra por concepto de entrada, o de un almacen a la tienda, la cantidad es positiva.
// TRASPASO_SALIDA: Cuando se realiza un traspaso desde una tienda a otra, o desde un almacen a una tienda por concepto de salida, la cantidad es negativa.
// DESAGREGACION_BAJA: Cuando se relaiza una baja de un producto por desagregación o porque se fracciona en otros productos
// DESAGREGACION_ALTA: Cuando se realiza un alta de un producto por desagregación de otro.

import { ILocal } from "./ILocal";
import { IProductoTienda } from "./IProducto";
import { IUser } from "./IUser";

export type ITipoMovimiento  = "COMPRA" | "VENTA" | "AJUSTE_ENTRADA" | "AJUSTE_SALIDA" | "TRASPASO_ENTRADA" | "TRASPASO_SALIDA" | "DESAGREGACION_BAJA" | "DESAGREGACION_ALTA";

interface ICreateMovimientoDTOGeneric {
  tipo: ITipoMovimiento;
  cantidad: number;
  motivo?: string;
  usuarioId: string;
  tiendaId: string;
  referenciaId?: string; // Puede guardar el ID de una Venta
}
export interface ICreateMovimientoFromProdDTO extends ICreateMovimientoDTOGeneric {
  productoId: string
}
export interface ICreateMovimientoFromTiendaProdDTO extends ICreateMovimientoDTOGeneric {
  tiendaProductoId: string;
}
export type ICreateMovimientoDTO =  ICreateMovimientoFromProdDTO | ICreateMovimientoFromTiendaProdDTO;

export interface IMovimiento {
  id:string;
  productoTienda?: IProductoTienda;
  productoTiendaId: string;
  tipo: ITipoMovimiento;
  cantidad: number;
  motivo: string;
  referenciaId?: string;
  fecha: Date;
  usuario?: IUser; 
  usuarioId: string;
  tienda?: ILocal;
  tiendaId: string
}