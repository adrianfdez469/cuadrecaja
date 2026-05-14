import axiosClient from '@/lib/axiosClient';
import type { IMoneda, IMonedaCreate, IDenominacionBillete, IDenominacionBilleteCreate, INegocioMoneda, INegocioMonedaCreate, INegocioMonedaUpdate, IMonedaConDenominaciones } from '@/schemas/moneda';

// ─── SUPER_ADMIN — monedas globales ──────────────────────────────────────────

export const getMonedasGlobales = async (): Promise<IMonedaConDenominaciones[]> => {
  const res = await axiosClient.get('/api/admin/monedas');
  return res.data;
};

export const createMoneda = async (data: IMonedaCreate): Promise<IMoneda> => {
  const res = await axiosClient.post('/api/admin/monedas', data);
  return res.data;
};

export const updateMoneda = async (code: string, data: Partial<IMonedaCreate & { activo: boolean }>): Promise<IMoneda> => {
  const res = await axiosClient.put(`/api/admin/monedas/${code}`, data);
  return res.data;
};

export const deactivateMoneda = async (code: string): Promise<IMoneda> => {
  const res = await axiosClient.delete(`/api/admin/monedas/${code}`);
  return res.data;
};

// ─── Denominaciones ───────────────────────────────────────────────────────────

export const getDenominaciones = async (code: string): Promise<IDenominacionBillete[]> => {
  const res = await axiosClient.get(`/api/admin/monedas/${code}/denominaciones`);
  return res.data;
};

export const createDenominacion = async (code: string, data: IDenominacionBilleteCreate): Promise<IDenominacionBillete> => {
  const res = await axiosClient.post(`/api/admin/monedas/${code}/denominaciones`, data);
  return res.data;
};

export const updateDenominacion = async (code: string, id: string, data: Partial<IDenominacionBillete>): Promise<IDenominacionBillete> => {
  const res = await axiosClient.put(`/api/admin/monedas/${code}/denominaciones/${id}`, data);
  return res.data;
};

export const deleteDenominacion = async (code: string, id: string): Promise<void> => {
  await axiosClient.delete(`/api/admin/monedas/${code}/denominaciones/${id}`);
};

// ─── ADMIN — monedas por negocio ──────────────────────────────────────────────

export const getMonedasNegocio = async (negocioId: string): Promise<INegocioMoneda[]> => {
  const res = await axiosClient.get(`/api/negocio/${negocioId}/monedas`);
  return res.data;
};

export const habilitarMonedaNegocio = async (negocioId: string, data: INegocioMonedaCreate): Promise<INegocioMoneda> => {
  const res = await axiosClient.post(`/api/negocio/${negocioId}/monedas`, data);
  return res.data;
};

export const updateMonedaNegocio = async (negocioId: string, code: string, data: INegocioMonedaUpdate): Promise<INegocioMoneda> => {
  const res = await axiosClient.put(`/api/negocio/${negocioId}/monedas/${code}`, data);
  return res.data;
};

export const deshabilitarMonedaNegocio = async (negocioId: string, code: string): Promise<void> => {
  await axiosClient.delete(`/api/negocio/${negocioId}/monedas/${code}`);
};
