import axios from 'axios';
import { IRol, ICreateRol, IUpdateRol } from '@/types/IRol';

const API_BASE = '/api/roles';

export const getRoles = async (negocioId?: string): Promise<IRol[]> => {
  const params = negocioId ? { negocioId } : {};
  const response = await axios.get(API_BASE, { params });
  return response.data;
};

export const getRolById = async (id: string): Promise<IRol> => {
  const response = await axios.get(`${API_BASE}/${id}`);
  return response.data;
};

export const createRol = async (rolData: ICreateRol): Promise<IRol> => {
  const response = await axios.post(API_BASE, rolData);
  return response.data;
};

export const updateRol = async (id: string, rolData: IUpdateRol): Promise<IRol> => {
  const response = await axios.put(`${API_BASE}/${id}`, rolData);
  return response.data;
};

export const deleteRol = async (id: string): Promise<void> => {
  await axios.delete(`${API_BASE}/${id}`);
}; 