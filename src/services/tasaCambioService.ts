import axiosClient from '@/lib/axiosClient';
import type { ITasaCambio, ITasaCambioCreate, ITasaSnapshot } from '@/schemas/tasaCambio';

export interface ITasasCambioResponse {
  tasas: ITasaCambio[];
  vigentes: ITasaSnapshot;
  monedaBase: string;
}

export interface ICambiarMonedaBasePreview {
  monedaActual: string;
  monedaNueva: string;
  tasa: number;
  totalProductos: number;
  preview: { nombre: string; precioAntes: number; precioDepues: number; costoAntes: number; costoDepues: number }[];
}

export const getTasasCambio = async (negocioId: string): Promise<ITasasCambioResponse> => {
  const res = await axiosClient.get(`/api/negocio/${negocioId}/tasas-cambio`);
  return res.data;
};

export const registrarTasaCambio = async (negocioId: string, data: ITasaCambioCreate): Promise<ITasaCambio> => {
  const res = await axiosClient.post(`/api/negocio/${negocioId}/tasas-cambio`, data);
  return res.data;
};

export const previewCambiarMonedaBase = async (negocioId: string, monedaNueva: string): Promise<ICambiarMonedaBasePreview> => {
  const res = await axiosClient.get(`/api/negocio/${negocioId}/cambiar-moneda-base`, {
    params: { monedaNueva },
  });
  return res.data;
};

export const ejecutarCambioMonedaBase = async (negocioId: string, monedaNueva: string): Promise<{ ok: boolean; monedaBase: string }> => {
  const res = await axiosClient.post(`/api/negocio/${negocioId}/cambiar-moneda-base`, { monedaNueva });
  return res.data;
};
