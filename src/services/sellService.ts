import axios from "axios";
import { cretateBatchMovimientos } from "./movimientoService";
import { IVenta } from "@/types/IVenta";
import { IProductoVenta } from "@/types/IProducto";


const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`; // Ruta base del backend

export const createSell = async (tiendaId: string, cierreId: string, usuarioId: string, total: number, totalcash: number, totaltransfer: number, productos: IProductoVenta[], syncId: string ): Promise<IVenta> => {
  
  const response = await axios.post(API_URL(tiendaId, cierreId), { 
    usuarioId,
    total,
    totalcash,
    totaltransfer,
    productos,
    syncId
  });

  const idVenta = response.data.id;

  await cretateBatchMovimientos(
    { tiendaId, usuarioId, tipo: 'VENTA', referenciaId: idVenta },
    productos.map(p => {
      return {
        cantidad: p.cantidad,
        productoId: p.productId
      }
    })
  )

  return response.data;
} 

export const getSells = async (tiendaId: string, cierreId: string): Promise<IVenta[]> => {
  const response = await axios.get(API_URL(tiendaId, cierreId));
  return response.data;
}

export const removeSell = async (tiendaId: string, cierreId: string, ventaId: string, usuarioId: string) => {
  const removed = await axios.delete(`${API_URL(tiendaId, cierreId)}/${ventaId}`, {
    params: {
      usuarioId: usuarioId
    }
  });
  return removed.data;
}