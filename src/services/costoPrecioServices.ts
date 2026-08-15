import axiosClient from "@/lib/axiosClient";
import type { IProductoTiendaPos } from "@/schemas/producto";

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

/**
 * The sale catalog, projected down to what the POS reads.
 *
 * Deliberately not `getProductosVenta`: that payload also carries costs,
 * descriptions and full supplier records for the inventory view, which for a
 * 2000-product shop is most of the bytes and none of the use.
 */
export const getCatalogoPos = async (
  tiendaId: string,
): Promise<IProductoTiendaPos[]> => {
  const response = await axiosClient.get(`${API_URL}/${tiendaId}/catalogo_pos`);
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
