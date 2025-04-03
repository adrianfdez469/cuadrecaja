import axios from "axios";

const API_URL = "/api/categorias"; // Ruta base del backend

export const fetchCategories = async () => {
  const response = await axios.get(API_URL);
  return response.data;
};

export const createCategory = async (nombre: string, color: string) => {
  console.log(nombre, color);
  const response = await axios.post(API_URL, { nombre, color });
  return response.data;
};

export const updateCategory = async (id: string, nombre: string, color: string) => {
  const response = await axios.put(`${API_URL}/${id}`, { nombre, color });
  return response.data;
};

export const deleteCategory = async (id: string) => {
  await axios.delete(`${API_URL}/${id}`);
};
