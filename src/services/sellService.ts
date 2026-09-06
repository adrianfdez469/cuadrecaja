import axiosClient, {
  RetryConfig,
  IDEMPOTENCY_KEY_HEADER,
} from "@/lib/axiosClient";
import { IVenta } from "@/schemas/venta";
import { IProductoVenta } from "@/schemas/producto";
import type { IMultimonedaExtras } from "@/schemas/pago";

const API_URL = (tiendaId: string, cierreId: string) =>
  `/api/venta/${tiendaId}/${cierreId}`;

/**
 * Un `createSell` fallido, con el motivo intacto.
 *
 * Quien lo recibe tiene que decidir si vale la pena reintentar, y para eso
 * necesita las dos cosas que este error conserva: el estado HTTP y el mensaje
 * del servidor. Lanzar un `new Error("SERVER_ERROR")` pelado perdía ambas, y
 * dejaba sin efecto las ramas que las miraban — las de «Existencia
 * insuficiente», «fuera del período actual» y `isPermanentSyncError`, que
 * nunca llegaban a cumplirse.
 */
export class CreateSellError extends Error {
  readonly response?: { status?: number; data?: { error?: string } };

  constructor(
    message: string,
    response?: { status?: number; data?: { error?: string } },
  ) {
    super(message);
    this.name = "CreateSellError";
    this.response = response;
  }
}

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
      throw new CreateSellError(
        "TIMEOUT_ERROR: La petición tardó demasiado en responder",
        error.response,
      );
    } else if (error.code === "ERR_NETWORK") {
      throw new CreateSellError(
        "NETWORK_ERROR: Error de conexión de red",
        error.response,
      );
    } else if (error.response?.status >= 500) {
      // El motivo del servidor viaja en el mensaje, no se descarta. Las
      // validaciones de negocio de `POST /api/venta` —«Existencia
      // insuficiente» entre ellas— se lanzan dentro de la transacción y salen
      // como 500: sin su texto, quien lo recibe no puede distinguir una venta
      // que el servidor nunca aceptará de un fallo pasajero que sí conviene
      // reintentar.
      throw new CreateSellError(
        `SERVER_ERROR: ${error.response?.data?.error || "Error interno del servidor"}`,
        error.response,
      );
    } else if (error.response?.status >= 400) {
      throw new CreateSellError(
        `CLIENT_ERROR: ${error.response?.data?.error || "Error en los datos enviados"}`,
        error.response,
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
) => {
  const removed = await axiosClient.delete(
    `${API_URL(tiendaId, cierreId)}/${ventaId}`,
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
