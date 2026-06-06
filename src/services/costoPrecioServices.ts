import axiosClient from "@/lib/axiosClient";

const API_URL = `/api/productos_tienda`;

export const fecthCostosPreciosProds = async (tiendaId: string) => {
  const response = await axiosClient.get(`${API_URL}/${tiendaId}`);
  return response.data;
};

export const getProductosVenta = async (
  tiendaId: string,
  params?: Record<string, unknown>,
) => {
  const response = await axiosClient.get(
    `${API_URL}/${tiendaId}/productos_venta`,
    { params },
  );
  return response.data;
};

export const createProductoTienda = async (
  tiendaId: string,
  productoId: string,
  precio: number,
  costo: number,
) => {
  const response = await axiosClient.post(`${API_URL}/${tiendaId}`, {
    productoId,
    precio,
    costo,
  });
  return response.data;
};

export const updateProductosTienda = async (
  tiendaId: string,
  productos: {
    id: string;
    fechaVencimiento?: string | null;
    precio?: number;
    costo?: number;
    monedaPrecioCode?: string | null;
    monedaCostoCode?: string | null;
  }[],
) => {
  const response = await axiosClient.put(`${API_URL}/${tiendaId}`, {
    productos,
  });
  return response.data;
};
