import { IProducto } from "@/types/IProducto";
import axios from "axios";

const API_URL = "/api/productos"; // Ruta base del backend

export const fetchProducts = async () => {
  const res = await axios.get<IProducto[]>(API_URL);
  const data = await res.data;
  return data;
};

export const createProduct = async (
  nombre: string, 
  descripcion: string, 
  categoriaId: string, 
  fraccion?: {fraccionDeId?: string, unidadesPorFraccion?: number},
  codigosProducto?: string[],
  permiteDecimal?: boolean
) => {
  await axios.post(API_URL, {
      descripcion: descripcion,
      nombre: nombre,
      categoriaId: categoriaId,
      ...(fraccion && {fraccion}),
      codigosProducto: codigosProducto || [],
      permiteDecimal: permiteDecimal
  });
}

export const editProduct = async (
  id: string, 
  nombre: string, 
  descripcion: string, 
  categoriaId: string, 
  fraccion?: {fraccionDeId?: string, unidadesPorFraccion?: number},
  codigosProducto?: string[],
  permiteDecimal?: boolean
) => {
  await axios.put(`${API_URL}/${id}`, {
      descripcion: descripcion,
      nombre: nombre,
      categoriaId: categoriaId,
      ...(fraccion && {fraccion}),
      codigosProducto: codigosProducto || [],
      permiteDecimal: permiteDecimal
  });
}

export const deleteProduct = async (id: string) => {
  await axios.delete(`${API_URL}/${id}`);
}

export const generateProductsCode = async (prodsCodes: {productoId: string, code: string}[]) => {
  return axios.post(`${API_URL}/bulk-code-generate`, {
    codes: prodsCodes
  })
}