// COMPRA: Movimientos de compras de producto. La cantidad es positiva. Cuando se compra un producto.
// VENTA:  Movimientos de ventas de producto. La cantidad es negativa. Cada vez que se realiza la venta de un producto.
// AJUSTE_ENTRADA: Movimiento de ajuste por motivo de sobrenates etc.
// AJUSTE_SALIDA: Movimiento de ajuste por motivo de faltantes.
// TRASPASO_ENTRADA: Cuando se realiza un traspaso de una tienda a otra por concepto de entrada, o de un almacen a la tienda, la cantidad es positiva.
// TRASPASO_SALIDA: Cuando se realiza un traspaso desde una tienda a otra, o desde un almacen a una tienda por concepto de salida, la cantidad es negativa.
// DESAGREGACION_BAJA: Cuando se relaiza una baja de un producto por desagregación o porque se fracciona en otros productos
// DESAGREGACION_ALTA: Cuando se realiza un alta de un producto por desagregación de otro.
// CONSIGNACION_ENTRADA: Cuando se realiza una consignación de un producto.
// CONSIGNACION_DEVOLUCION: Cuando se realiza una devolución de un producto.

import { IProducto } from "./IProducto";
import { IProveedor } from "./IProveedor";

export type ITipoMovimiento  = "COMPRA" | "VENTA" | "AJUSTE_ENTRADA" | "AJUSTE_SALIDA" | "TRASPASO_ENTRADA" | "TRASPASO_SALIDA" | "DESAGREGACION_BAJA" | "DESAGREGACION_ALTA" | "CONSIGNACION_ENTRADA" | "CONSIGNACION_DEVOLUCION";


export interface IMovimiento {
  id: string;
  fecha: Date;
  tipo: ITipoMovimiento;
  cantidad: number;
  motivo?: string;
  costoUnitario?: number;
  costoTotal?: number;
  costoAnterior?: number;
  costoNuevo?: number;
  existenciaAnterior?: number;
  productoTienda: {
    id: string;
    costo: number;
    precio: number;
    existencia: number;
    producto: IProducto;
    proveedor?: IProveedor;
  };
  usuario?: {
    id: string;
    nombre: string;
  };
}

export interface IMovimientoCreate {
  productoId: string;
  cantidad: number;
  costoUnitario?: number;
  costoTotal?: number;
}

export interface IMovimientoData {
  tipo: MovimientoTipo;
  tiendaId: string;
  usuarioId: string;
  referenciaId?: string;
  motivo?: string;
  proveedorId?: string;
}

export enum MovimientoTipo {
  COMPRA = 'COMPRA',
  VENTA = 'VENTA',
  TRASPASO_ENTRADA = 'TRASPASO_ENTRADA',
  TRASPASO_SALIDA = 'TRASPASO_SALIDA',
  AJUSTE_SALIDA = 'AJUSTE_SALIDA',
  AJUSTE_ENTRADA = 'AJUSTE_ENTRADA',
  DESAGREGACION_BAJA = 'DESAGREGACION_BAJA',
  DESAGREGACION_ALTA = 'DESAGREGACION_ALTA',
  CONSIGNACION_ENTRADA = 'CONSIGNACION_ENTRADA',
  CONSIGNACION_DEVOLUCION = 'CONSIGNACION_DEVOLUCION'
}