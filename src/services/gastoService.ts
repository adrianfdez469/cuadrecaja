import axios from "@/lib/axiosClient";
import type {
  IGastoPlantilla,
  IGastoTienda,
  IGastoCierre,
  IGastoPreview,
  ICreateGastoPlantilla,
  IUpdateGastoPlantilla,
  ICreateGastoTienda,
  IUpdateGastoTienda,
  IAssignPlantilla,
  IGastoAdHocCreate,
  IGastosCierreResponse,
  IGastosPreviewResponse,
} from "@/schemas/gastos";
export type { IGastosCierreResponse, IGastosPreviewResponse } from "@/schemas/gastos";

// ─── Plantillas (nivel negocio) ──────────────────────────────────────────────

export const getPlantillas = async (): Promise<(IGastoPlantilla & { _count?: { asignaciones: number } })[]> => {
  const res = await axios.get("/api/gastos/plantillas");
  return res.data;
};

export const createPlantilla = async (data: ICreateGastoPlantilla): Promise<IGastoPlantilla> => {
  const res = await axios.post("/api/gastos/plantillas", data);
  return res.data;
};

export const updatePlantilla = async (id: string, data: IUpdateGastoPlantilla): Promise<IGastoPlantilla> => {
  const res = await axios.put(`/api/gastos/plantillas/${id}`, data);
  return res.data;
};

export const deletePlantilla = async (id: string): Promise<void> => {
  await axios.delete(`/api/gastos/plantillas/${id}`);
};

// ─── Gastos por tienda ───────────────────────────────────────────────────────

export const getGastosTienda = async (
  tiendaId: string,
  activo?: boolean
): Promise<IGastoTienda[]> => {
  const params: Record<string, string> = {};
  if (activo !== undefined) params.activo = String(activo);
  const res = await axios.get(`/api/gastos/tienda/${tiendaId}`, { params });
  return res.data;
};

export const createGastoTienda = async (
  tiendaId: string,
  data: ICreateGastoTienda
): Promise<IGastoTienda> => {
  const res = await axios.post(`/api/gastos/tienda/${tiendaId}`, data);
  return res.data;
};

export const updateGastoTienda = async (
  tiendaId: string,
  gastoId: string,
  data: IUpdateGastoTienda
): Promise<IGastoTienda> => {
  const res = await axios.put(`/api/gastos/tienda/${tiendaId}/${gastoId}`, data);
  return res.data;
};

export const deleteGastoTienda = async (tiendaId: string, gastoId: string): Promise<void> => {
  await axios.delete(`/api/gastos/tienda/${tiendaId}/${gastoId}`);
};

export const assignPlantilla = async (
  tiendaId: string,
  data: IAssignPlantilla
): Promise<IGastoTienda> => {
  const res = await axios.post(`/api/gastos/tienda/${tiendaId}/assign`, data);
  return res.data;
};

// ─── Gastos de cierre ────────────────────────────────────────────────────────

export const getGastosCierre = async (cierreId: string): Promise<IGastosCierreResponse> => {
  const res = await axios.get(`/api/gastos/cierre/${cierreId}`);
  return res.data;
};

export const previewGastosCierre = async (cierreId: string): Promise<IGastosPreviewResponse> => {
  const res = await axios.post(`/api/gastos/cierre/${cierreId}/preview`);
  return res.data;
};

export const applyGastosCierre = async (
  cierreId: string,
  gastosToApply: IGastoPreview[]
): Promise<IGastoCierre[]> => {
  const res = await axios.post(`/api/gastos/cierre/${cierreId}/apply`, { gastosToApply });
  return res.data;
};

// ─── Gastos ad-hoc ───────────────────────────────────────────────────────────

export const createGastoAdHoc = async (
  cierreId: string,
  data: IGastoAdHocCreate
): Promise<IGastoCierre> => {
  const res = await axios.post(`/api/gastos/cierre/${cierreId}/adhoc`, data);
  return res.data;
};

export const deleteGastoAdHoc = async (cierreId: string, gastoId: string): Promise<void> => {
  await axios.delete(`/api/gastos/cierre/${cierreId}/adhoc/${gastoId}`);
};
