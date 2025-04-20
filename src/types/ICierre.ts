import { ILocal } from "./ILocal";

export interface ICierrePeriodo {
  id: string;
  fechaInicio: Date;
  fechaFin?: Date;
  tiendaId: string;
  tienda: ILocal;
  totalVentas: number;
  totalGanancia: number;
  totalInversion: number;
  totalTransferencia: number;
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
  totalTransferencia: number;
}

export interface ISummaryCierre {
  cierres: Omit<ICierrePeriodo, "tienda">[];
  sumTotalGanancia: number;
  sumTotalInversion: number;
  sumTotalVentas: number;
  sumTotalTransferencia: number;
  totalItems: number;
}


