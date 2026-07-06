import { IProducto, IProductoDeleteInfo } from "@/schemas/producto";
import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/productos"; // Ruta base del backend

export const fetchProducts = async (text?: string) => {
  const res = await axiosClient.get<IProducto[]>(API_URL, {
    params: text ? { text } : undefined,
  });
  const data = await res.data;
  return data;
};

export const createProduct = async (
  nombre: string,
  descripcion: string,
  categoriaId: string,
  fraccion?: { fraccionDeId?: string; unidadesPorFraccion?: number },
  codigosProducto?: string[],
  permiteDecimal?: boolean,
): Promise<IProducto> => {
  const res = await axiosClient.post<IProducto>(API_URL, {
    descripcion: descripcion,
    nombre: nombre,
    categoriaId: categoriaId,
    ...(fraccion && { fraccion }),
    codigosProducto: codigosProducto || [],
    permiteDecimal: permiteDecimal,
  });
  return res.data;
};

export const editProduct = async (
  id: string,
  nombre: string,
  descripcion: string,
  categoriaId: string,
  fraccion?: { fraccionDeId?: string; unidadesPorFraccion?: number },
  codigosProducto?: string[],
  permiteDecimal?: boolean,
) => {
  await axiosClient.put(`${API_URL}/${id}`, {
    descripcion: descripcion,
    nombre: nombre,
    categoriaId: categoriaId,
    ...(fraccion && { fraccion }),
    codigosProducto: codigosProducto || [],
    permiteDecimal: permiteDecimal,
  });
};

export const getProductDeleteInfo = async (
  id: string,
  tiendaId: string,
  productoTiendaId?: string,
): Promise<IProductoDeleteInfo> => {
  const res = await axiosClient.get<IProductoDeleteInfo>(`${API_URL}/${id}`, {
    params: { tiendaId, ...(productoTiendaId && { productoTiendaId }) },
  });
  return res.data;
};

export const deleteProduct = async (
  id: string,
  tiendaId: string,
  productoTiendaId?: string,
) => {
  await axiosClient.delete(`${API_URL}/${id}`, {
    params: { tiendaId, ...(productoTiendaId && { productoTiendaId }) },
  });
};

export const generateProductsCode = async (
  prodsCodes: { productoId: string; code: string }[],
) => {
  return axiosClient.post(`${API_URL}/bulk-code-generate`, {
    codes: prodsCodes,
  });
};

export const asociarCodigoProducto = async (
  productoId: string,
  codigo: string,
) => {
  const res = await axiosClient.post(
    `${API_URL}/${productoId}/agregar-codigo`,
    { codigo },
  );
  return res.data;
};
