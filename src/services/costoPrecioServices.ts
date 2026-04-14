import axiosClient from '@/lib/axiosClient';

const API_URL = `/api/productos_tienda`;

export const fecthCostosPreciosProds = async (tiendaId: string) => {
  const response = await axiosClient.get(`${API_URL}/${tiendaId}`);
  return response.data;
}

export const getProductosVenta = async (tiendaId: string, params?: Record<string, unknown>) => {
  const response = await axiosClient.get(`${API_URL}/${tiendaId}/productos_venta`, { params });
  return response.data;
}

export const updateProductosTienda = async (tiendaId: string, productos: { id: string; fechaVencimiento?: string | null }[]) => {
  const response = await axiosClient.put(`${API_URL}/${tiendaId}`, { productos });
  return response.data;
}