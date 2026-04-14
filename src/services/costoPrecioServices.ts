import axiosClient from '@/lib/axiosClient';

const API_URL = `/api/productos_tienda`;

export const fecthCostosPreciosProds = async (tiendaId: string) => {
  const response = await axiosClient.get(`${API_URL}/${tiendaId}`);
  return response.data;
}