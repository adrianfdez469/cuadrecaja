import axiosClient, { IDEMPOTENCY_KEY_HEADER } from "@/lib/axiosClient";
import { generateUUID } from "@/utils/uuid";
import {
  IBuscarVentasResponse,
  IDevolucionVentaCreate,
} from "@/schemas/devolucionVenta";

export const buscarVentas = async (
  tiendaId: string,
  filtros: { fechaInicio?: string; fechaFin?: string; search?: string },
): Promise<IBuscarVentasResponse> => {
  const response = await axiosClient.get(`/api/venta/${tiendaId}/buscar`, {
    params: filtros,
  });
  return response.data;
};

/**
 * Registers a sale return.
 *
 * Returning is cumulative, so replaying the request would give the stock back
 * twice. The idempotency key lets the server recognise the resend; callers that
 * also want to cover a manual retry must pass a stable one.
 */
export const registrarDevolucionVenta = async (
  tiendaId: string,
  ventaId: string,
  data: IDevolucionVentaCreate,
  idempotencyKey?: string,
): Promise<void> => {
  await axiosClient.post(
    `/api/venta/${tiendaId}/devolucion/${ventaId}`,
    data,
    {
      headers: {
        [IDEMPOTENCY_KEY_HEADER]: idempotencyKey ?? generateUUID(),
      },
    },
  );
};
