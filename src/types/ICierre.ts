import { ILocal } from "./ILocal";

export interface ICierrePeriodo {
  id: string;
  fechaInicio: Date;
  fechaFin?: Date;
  tiendaId: string;
  tienda: ILocal;
}

interface ICierreProductoVendidos {
  id: string; 
  nombre: string; 
  costo: number;
  precio: number; 
  cantidad: number;
  total: number;
  ganancia: number;
}

export interface ICierreData {
  productosVendidos: ICierreProductoVendidos[],
  totalVentas: number;
  totalGanancia: number;
}
