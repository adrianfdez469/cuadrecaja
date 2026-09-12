import axiosClient from "@/lib/axiosClient";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";
import {
  cuentaPorCobrarDetalleResponseSchema,
  cuentasPorCobrarListResponseSchema,
  deudorDetalleClientSchema,
  movimientoAplicadoResponseSchema,
} from "@/schemas/cuentasPorCobrarPanel";
import type {
  ICuentaPorCobrarDetalleResponse,
  ICuentasPorCobrarFiltros,
  ICuentasPorCobrarListResponse,
  IDeudorDetalleClient,
  IMovimientoAplicadoResponse,
  IPerdonarDeuda,
  IRegistrarAbono,
  IRevertirAbono,
} from "@/schemas/cuentasPorCobrarPanel";

/**
 * The services layer is the only one that talks to Axios (`AGENTS.md`). No rule lives here: the
 * screen decides what to send and the API decides what to accept.
 *
 * EVERY response is parsed with its schema before it leaves this file, and that is not belt and
 * braces — it is the ONLY place where the wire's JSON strings become the `Date` objects the types
 * of this feature promise. `axios` does not revive dates: it hands back exactly what
 * `JSON.parse` produced. Returning `response.data` raw makes every `Date` in the declared type a
 * lie, and the lie only surfaces where something calls a `Date` method — `buildMovimientoRows`
 * sorts with `fecha.getTime()`, which `Array.prototype.sort` never reaches with fewer than two
 * elements, so the fault stayed invisible until an account had a second movement.
 *
 * The parse belongs HERE and not in a defensive `new Date(...)` inside the comparator: the type
 * is lost at this boundary, so this is where it is restored, once, for every field at once.
 */
const API_URL = "/api/cuentas-por-cobrar";

export const getCuentasPorCobrar = async (
  filtros: ICuentasPorCobrarFiltros,
): Promise<ICuentasPorCobrarListResponse> => {
  const search = new URLSearchParams();
  if (filtros?.tiendaId) search.append("tiendaId", filtros.tiendaId);
  if (filtros?.clienteId) search.append("clienteId", filtros.clienteId);
  if (filtros?.antiguedad) search.append("antiguedad", filtros.antiguedad);
  if (filtros?.estado) search.append("estado", filtros.estado);

  const query = search.toString();
  const response = await axiosClient.get(query ? `${API_URL}?${query}` : API_URL);
  return cuentasPorCobrarListResponseSchema.parse(response.data);
};

export const getCuentaPorCobrar = async (
  cuentaId: string,
): Promise<ICuentaPorCobrarDetalleResponse> => {
  const response = await axiosClient.get(`${API_URL}/${cuentaId}`);
  return cuentaPorCobrarDetalleResponseSchema.parse(response.data);
};

export const getDeudorDetalle = async (
  clienteId: string,
): Promise<IDeudorDetalleClient> => {
  const response = await axiosClient.get(`${API_URL}/cliente/${clienteId}`);
  return deudorDetalleClientSchema.parse(response.data);
};

const idempotentHeaders = (idempotencyKey: string) => ({
  headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
});

/** `idempotencyKey` is required: it is stable per open dialog and renewed only after success. */
export const registrarAbono = async (
  cuentaId: string,
  body: IRegistrarAbono,
  idempotencyKey: string,
): Promise<IMovimientoAplicadoResponse> => {
  const response = await axiosClient.post(
    `${API_URL}/${cuentaId}/abono`,
    body,
    idempotentHeaders(idempotencyKey),
  );
  return movimientoAplicadoResponseSchema.parse(response.data);
};

export const perdonarDeuda = async (
  cuentaId: string,
  body: IPerdonarDeuda,
  idempotencyKey: string,
): Promise<IMovimientoAplicadoResponse> => {
  const response = await axiosClient.post(
    `${API_URL}/${cuentaId}/perdonar`,
    body,
    idempotentHeaders(idempotencyKey),
  );
  return movimientoAplicadoResponseSchema.parse(response.data);
};

export const revertirAbono = async (
  cuentaId: string,
  body: IRevertirAbono,
  idempotencyKey: string,
): Promise<IMovimientoAplicadoResponse> => {
  const response = await axiosClient.post(
    `${API_URL}/${cuentaId}/reversion`,
    body,
    idempotentHeaders(idempotencyKey),
  );
  return movimientoAplicadoResponseSchema.parse(response.data);
};
