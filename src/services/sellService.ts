import axios from "axios";
import { IVenta } from "@/types/IVenta";
import { IProductoVenta } from "@/types/IProducto";

const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`;

export const createSell = async (
  tiendaId: string, 
  cierreId: string, 
  usuarioId: string, 
  total: number, 
  totalcash: number, 
  totaltransfer: number, 
  productos: IProductoVenta[], 
  syncId: string,
  transferDestinationId?: string
): Promise<IVenta> => {
  
  console.log('🔍 [createSell] Iniciando petición al backend:', {
    url: API_URL(tiendaId, cierreId),
    payload: {
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      productos,
      syncId,
      ...(totaltransfer > 0 && { transferDestinationId })
    }
  });

  try {
    const response = await axios.post(API_URL(tiendaId, cierreId), { 
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      productos,
      syncId,
      transferDestinationId
    });

    console.log('🔍 [createSell] Respuesta del backend:', response.data);

    // Ya no necesitamos crear movimientos por separado 
    // porque ahora todo se maneja en una sola transacción atómica
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