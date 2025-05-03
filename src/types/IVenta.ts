import { IUser } from "./IUser";

export interface IVenta {
  id: string;
  createdAt: Date;
  total: number;
  totalcash: number;
  totaltransfer: number;
  tiendaId: string;
  usuarioId: string;
  cierrePeriodoId: string;
  productos?: VentaProducto[];
  usuario?: IUser;
  syncId?: string; 
}

interface VentaProducto {
  id: string;
  ventaId: string;
  productoTiendaId: string;
  cantidad: number;
  name?: string;
  price?: number;
}