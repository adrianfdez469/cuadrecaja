import type { IPlan, ICreatePlan, IUpdatePlan } from '@/schemas/plan';
import axios from 'axios';

const API_URL = '/api/planes';

export const getPlanes = async (): Promise<IPlan[]> => {
  const response = await axios.get<IPlan[]>(API_URL);
  return response.data;
};

export const createPlan = async (data: ICreatePlan): Promise<IPlan> => {
  const response = await axios.post<IPlan>(API_URL, data);
  return response.data;
};

export const updatePlan = async (id: string, data: IUpdatePlan): Promise<IPlan> => {
  const response = await axios.put<IPlan>(`${API_URL}/${id}`, data);
  return response.data;
};

export const deletePlan = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/${id}`);
};
