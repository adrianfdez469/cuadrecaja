import { IProveedor, IProveedorCreate, IProveedorUpdate } from "@/types/IProveedor";
import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/proveedores"; // Ruta base del backend

export const getProveedores = async (nombre?: string): Promise<IProveedor[]> => {
  const params = new URLSearchParams();
  if (nombre) {
    params.append('nombre', nombre);
  }
  
  const response = await axiosClient.get<IProveedor[]>(`${API_URL}?${params.toString()}`);
  return response.data;
};

export const getProveedorById = async (id: string): Promise<IProveedor> => {
  const response = await axiosClient.get<IProveedor>(`${API_URL}/${id}`);
  return response.data;
};

export const createProveedor = async (proveedor: IProveedorCreate): Promise<IProveedor> => {
  const response = await axiosClient.post<IProveedor>(API_URL, proveedor);
  return response.data;
};

export const updateProveedor = async (id: string, proveedor: IProveedorUpdate): Promise<IProveedor> => {
  const response = await axiosClient.put<IProveedor>(`${API_URL}/${id}`, proveedor);
  return response.data;
};

export const deleteProveedor = async (id: string): Promise<void> => {
  await axiosClient.delete(`${API_URL}/${id}`);
}; 