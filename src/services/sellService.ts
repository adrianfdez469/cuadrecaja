import axiosClient, { RetryConfig } from "@/lib/axiosClient";
import { IVenta } from "@/schemas/venta";
import { IProductoVenta } from "@/schemas/producto";

const API_URL = (tiendaId: string, cierreId: string) => `/api/venta/${tiendaId}/${cierreId}`;

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
  createdAt?: number,
  wasOffline?: boolean,
  syncAttempts?: number,
  discountCodes?: string[]
): Promise<IVenta> => {
  try {
    const response = await axiosClient.post(
      API_URL(tiendaId, cierreId),
      {
        usuarioId,
        total,
        totalcash,
        totaltransfer,
        productos,
        syncId,
        createdAt,
        wasOffline,
        syncAttempts,
        transferDestinationId,
        ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {})
      },
      { _retryCount: 0 } as RetryConfig
    );

    return response.data;
  } catch (error) {
    console.error("❌ [createSell] Error en la petición:", error.response?.data || error.message);

    if (error.code === "ECONNABORTED") {
      throw new Error("TIMEOUT_ERROR: La petición tardó demasiado en responder");
    } else if (error.code === "ERR_NETWORK") {
      throw new Error("NETWORK_ERROR: Error de conexión de red");
    } else if (error.response?.status >= 500) {
      throw new Error("SERVER_ERROR: Error interno del servidor");
    } else if (error.response?.status >= 400) {
      throw new Error(`CLIENT_ERROR: ${error.response?.data?.error || "Error en los datos enviados"}`);
    }

    throw error;
  }
};

export const getSells = async (tiendaId: string, cierreId: string): Promise<IVenta[]> => {
  const response = await axiosClient.get(API_URL(tiendaId, cierreId));
  return response.data;
};

export const removeSell = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
  usuarioId: string
) => {
  const removed = await axiosClient.delete(`${API_URL(tiendaId, cierreId)}/${ventaId}`, {
    params: { usuarioId }
  });
  return removed.data;
};

export const removeProductFromSale = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
  ventaProductoId: string
) => {
  const response = await axiosClient.delete(
    `${API_URL(tiendaId, cierreId)}/${ventaId}/producto/${ventaProductoId}`
  );
  return response.data;
};
