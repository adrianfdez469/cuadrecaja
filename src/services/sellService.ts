import axios from "axios";
import { cretateBatchMovimientos } from "./movimientoService";
import { IVenta } from "@/types/IVenta";
import { IProductoVenta } from "@/types/IProducto";


const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`; // Ruta base del backend

export const createSell = async (tiendaId: string, cierreId: string, usuarioId: string, total: number, totalcash: number, totaltransfer: number, productos: IProductoVenta[], syncId: string ): Promise<IVenta> => {
  
  console.log('🔍 [createSell] Iniciando petición al backend:', {
    url: API_URL(tiendaId, cierreId),
    payload: {
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      productos,
      syncId
    }
  });

  try {
    const response = await axios.post(API_URL(tiendaId, cierreId), { 
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      productos,
      syncId
    });

    console.log('🔍 [createSell] Respuesta del backend:', response.data);

    const idVenta = response.data.id;

    console.log('🔍 [createSell] Creando movimientos de stock para venta:', idVenta);

    await cretateBatchMovimientos(
      { tiendaId, usuarioId, tipo: 'VENTA', referenciaId: idVenta },
      productos.map(p => {
        return {
          cantidad: p.cantidad,
          productoId: p.productId
        }
      })
    );

    console.log('🔍 [createSell] Movimientos de stock creados exitosamente');

    return response.data;
  } catch (error) {
    console.error('❌ [createSell] Error en la petición:', error.response?.data || error.message);
    throw error;
  }
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