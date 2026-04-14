import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/categorias"; // Ruta base del backend

export const fetchCategories = async () => {
  const response = await axiosClient.get(API_URL);
  return response.data;
};

export const createCategory = async (nombre: string, color: string, esGlobal = false) => {
  const response = await axiosClient.post(API_URL, { nombre, color, esGlobal });
  return response.data;
};

export const updateCategory = async (id: string, nombre: string, color: string) => {
  const response = await axiosClient.put(`${API_URL}/${id}`, { nombre, color });
  return response.data;
};

export const deleteCategory = async (id: string) => {
  await axiosClient.delete(`${API_URL}/${id}`);
};
