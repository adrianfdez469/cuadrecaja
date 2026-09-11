import axiosClient from "@/lib/axiosClient";
import { ventaCreditoDetalleResponseSchema } from "@/schemas/ventaCredito";
import type { IVentaCreditoDetalleResponse } from "@/schemas/ventaCredito";

/**
 * The only Axios call F-037 adds. No rule lives here: the screen decides when to ask and the
 * route decides what to answer.
 *
 * The response IS parsed with its schema before it leaves this file, and that is not belt and
 * braces: it is the only place where the wire's date STRINGS become the `Date` objects the type
 * of this feature promises. `axios` does not revive dates — it hands back exactly what
 * `JSON.parse` produced — so returning `response.data` raw would make every `Date` in the
 * declared type a lie, and the lie would only surface where something sorts or formats one
 * (E-074).
 */
export const getVentaCredito = async (
  tiendaId: string,
  cierreId: string,
  ventaId: string,
): Promise<IVentaCreditoDetalleResponse> => {
  const response = await axiosClient.get(
    `/api/venta/${tiendaId}/${cierreId}/${ventaId}/credito`,
  );
  return ventaCreditoDetalleResponseSchema.parse(response.data);
};
