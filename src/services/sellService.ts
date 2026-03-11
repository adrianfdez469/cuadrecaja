import axios, { AxiosRequestConfig } from "axios";
import { IVenta } from "@/types/IVenta";
import { IProductoVenta } from "@/types/IProducto";

const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`;

// Extender la interfaz de configuración de axios para incluir propiedades de reintento
interface RetryConfig extends AxiosRequestConfig {
  _retryCount?: number;
}

// Configuración de axios con timeout y reintentos
const axiosInstance = axios.create({
  timeout: 30000, // 30 segundos de timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Interceptor para reintentos automáticos
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config } = error;
    
    // Solo reintentar para errores de red y timeouts
    if ((error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') && 
        config && (config as RetryConfig)._retryCount < 2) {
      
      (config as RetryConfig)._retryCount = ((config as RetryConfig)._retryCount || 0) + 1;
      
      console.log(`🔄 Reintentando petición (intento ${(config as RetryConfig)._retryCount}/2)...`);
      
      // Esperar 2 segundos antes del reintento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return axiosInstance(config);
    }
    
    return Promise.reject(error);
  }
);

export const createSell = async (
  tiendaId: string, 
  cierreId: string, 
  usuarioId: string, 
  total: number, 
  totalcash: number, 
  totaltransfer: number, 
  productos: IProductoVenta[], 
  syncId: string,
  transferDestinationId?: string,
  createdAt?: number, // 🆕 Nuevo parámetro
  wasOffline?: boolean, // 🆕 Nuevo parámetro
  syncAttempts?: number, // 🆕 Nuevo parámetro
  discountCodes?: string[] // 🆕 Códigos de descuento opcionales
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
      createdAt, // 🆕 Incluir timestamp de creación
      wasOffline, // 🆕 Incluir estado offline
      syncAttempts, // 🆕 Incluir intentos de sincronización
      ...(totaltransfer > 0 && { transferDestinationId }),
      ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {})
    }
  });

  try {
    const response = await axiosInstance.post(API_URL(tiendaId, cierreId), { 
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      productos,
      syncId,
      createdAt, // 🆕 Enviar timestamp de creación
      wasOffline, // 🆕 Enviar estado offline
      syncAttempts, // 🆕 Enviar intentos de sincronización
      transferDestinationId,
      ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {})
    }, {
      _retryCount: 0 // Inicializar contador de reintentos
    } as RetryConfig);

    console.log('🔍 [createSell] Respuesta del backend:', response.data);

    // Ya no necesitamos crear movimientos por separado 
    // porque ahora todo se maneja en una sola transacción atómica
    return response.data;
    
  } catch (error) {
    console.error('❌ [createSell] Error en la petición:', error.response?.data || error.message);
    
    // Clasificar el tipo de error para mejor manejo
    if (error.code === 'ECONNABORTED') {
      throw new Error('TIMEOUT_ERROR: La petición tardó demasiado en responder');
    } else if (error.code === 'ERR_NETWORK') {
      throw new Error('NETWORK_ERROR: Error de conexión de red');
    } else if (error.response?.status >= 500) {
      throw new Error('SERVER_ERROR: Error interno del servidor');
    } else if (error.response?.status >= 400) {
      throw new Error(`CLIENT_ERROR: ${error.response?.data?.error || 'Error en los datos enviados'}`);
    }
    
    throw error;
  }
}

export const getSells = async (tiendaId: string, cierreId: string): Promise<IVenta[]> => {
  const response = await axiosInstance.get(API_URL(tiendaId, cierreId));
  return response.data;
}

export const removeSell = async (tiendaId: string, cierreId: string, ventaId: string, usuarioId: string) => {
  const removed = await axiosInstance.delete(`${API_URL(tiendaId, cierreId)}/${ventaId}`, {
    params: {
      usuarioId: usuarioId
    }
  });
  return removed.data;
};

export const removeProductFromSale = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
  ventaProductoId: string
) => {
  const response = await axiosInstance.delete(
    `${API_URL(tiendaId, cierreId)}/${ventaId}/producto/${ventaProductoId}`
  );
  return response.data;
};