import axiosClient, {
  RetryConfig,
  IDEMPOTENCY_KEY_HEADER,
} from "@/lib/axiosClient";
import { IVenta } from "@/schemas/venta";
import { IProductoVenta } from "@/schemas/producto";
import type { IMultimonedaExtras } from "@/schemas/pago";

const API_URL = (tiendaId: string, cierreId: string) =>
  `/api/venta/${tiendaId}/${cierreId}`;

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
  discountCodes?: string[],
  multimoneda?: IMultimonedaExtras,
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
        ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {}),
        ...(multimoneda
          ? {
              monedaCobro: multimoneda.monedaCobro,
              pagosDetalle: multimoneda.pagosDetalle,
              vueltoDetalle: multimoneda.vueltoDetalle,
              tasaSnapshot: multimoneda.tasaSnapshot,
              // A diferencia de discountTotal —que el servidor recalcula desde
              // las reglas— la propina es una decisión del cajero y no se puede
              // derivar: hay que transportarla. El servidor la valida.
              ...(multimoneda.tipTotal && multimoneda.tipTotal > 0
                ? {
                    tipTotal: multimoneda.tipTotal,
                    tipDetail: multimoneda.tipDetail,
                  }
                : {}),
            }
          : {}),
      },
      {
        _retryCount: 0,
        // The sale is deduplicated by `syncId` on the server, so retrying is
        // safe. Without this header the interceptor no longer retries POSTs.
        headers: { [IDEMPOTENCY_KEY_HEADER]: syncId },
      } as RetryConfig,
    );

    return response.data;
  } catch (error) {
    console.error(
      "❌ [createSell] Error en la petición:",
      error.response?.data || error.message,
    );

    if (error.code === "ECONNABORTED") {
      throw new Error(
        "TIMEOUT_ERROR: La petición tardó demasiado en responder",
      );
    } else if (error.code === "ERR_NETWORK") {
      throw new Error("NETWORK_ERROR: Error de conexión de red");
    } else if (error.response?.status >= 500) {
      throw new Error("SERVER_ERROR: Error interno del servidor");
    } else if (error.response?.status >= 400) {
      throw new Error(
        `CLIENT_ERROR: ${error.response?.data?.error || "Error en los datos enviados"}`,
      );
    }

    throw error;
  }
};

export const getSells = async (
  tiendaId: string,
  cierreId: string,
): Promise<IVenta[]> => {
  const response = await axiosClient.get(API_URL(tiendaId, cierreId));
  return response.data;
};

export const removeSell = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
  usuarioId: string,
) => {
  const removed = await axiosClient.delete(
    `${API_URL(tiendaId, cierreId)}/${ventaId}`,
    {
      params: { usuarioId },
    },
  );
  return removed.data;
};

export const removeProductFromSale = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
  ventaProductoId: string,
) => {
  const response = await axiosClient.delete(
    `${API_URL(tiendaId, cierreId)}/${ventaId}/producto/${ventaProductoId}`,
  );
  return response.data;
};
