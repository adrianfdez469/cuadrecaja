import axiosClient from "@/lib/axiosClient";
import type {
  ICliente,
  ICreateCliente,
  IUpdateCliente,
} from "@/schemas/cliente";
import type {
  IClienteConSaldo,
  IClienteUpsertResponse,
} from "@/schemas/clienteSaldo";

/**
 * The services layer is the only one that talks to Axios (`AGENTS.md`). Neither a component
 * nor the hook calls `axiosClient` directly.
 */
const API_URL = "/api/clientes";

export async function getClientes(params?: {
  nombre?: string;
  limit?: number;
}): Promise<IClienteConSaldo[]> {
  const search = new URLSearchParams();
  if (params?.nombre) search.append("nombre", params.nombre);
  if (params?.limit !== undefined) search.append("limit", String(params.limit));

  const query = search.toString();
  const response = await axiosClient.get<IClienteConSaldo[]>(
    query ? `${API_URL}?${query}` : API_URL,
  );
  return response.data;
}

export async function getClienteById(id: string): Promise<IClienteConSaldo> {
  const response = await axiosClient.get<IClienteConSaldo>(`${API_URL}/${id}`);
  return response.data;
}

/** Resolves with `action` so the caller can tell a fresh row from a reactivated one. */
export async function createCliente(
  input: ICreateCliente,
): Promise<IClienteUpsertResponse> {
  const response = await axiosClient.post<IClienteUpsertResponse>(
    API_URL,
    input,
  );
  return response.data;
}

export async function updateCliente(
  id: string,
  input: IUpdateCliente,
): Promise<IClienteConSaldo> {
  const response = await axiosClient.put<IClienteConSaldo>(
    `${API_URL}/${id}`,
    input,
  );
  return response.data;
}

/** Rejects with the Axios error on 409; its `response.data` is an `IClienteDeleteConflict`. */
export async function deleteCliente(id: string): Promise<ICliente> {
  const response = await axiosClient.delete<ICliente>(`${API_URL}/${id}`);
  return response.data;
}
