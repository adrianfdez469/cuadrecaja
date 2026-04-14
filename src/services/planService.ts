import type { IPlan, ICreatePlan, IUpdatePlan } from '@/schemas/plan';
import axiosClient from '@/lib/axiosClient';

const API_URL = '/api/planes';

export const getPlanes = async (): Promise<IPlan[]> => {
  const response = await axiosClient.get<IPlan[]>(API_URL);
  return response.data;
};

export const createPlan = async (data: ICreatePlan): Promise<IPlan> => {
  const response = await axiosClient.post<IPlan>(API_URL, data);
  return response.data;
};

export const updatePlan = async (id: string, data: IUpdatePlan): Promise<IPlan> => {
  const response = await axiosClient.put<IPlan>(`${API_URL}/${id}`, data);
  return response.data;
};

export const deletePlan = async (id: string): Promise<void> => {
  await axiosClient.delete(`${API_URL}/${id}`);
};
