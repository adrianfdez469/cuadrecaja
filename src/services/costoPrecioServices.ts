import axios from 'axios';

const API_URL = `/api/productos_tienda`;

export const fecthCostosPreciosProds = async (tiendaId: string) => {
  const response = await axios.get(`${API_URL}/${tiendaId}`);
  return response.data;
}