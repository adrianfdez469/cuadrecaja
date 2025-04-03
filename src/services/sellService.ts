interface IProductoVenta {
  productoTiendaId: string;
  cantidad: number;
}

import axios from "axios";

const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`; // Ruta base del backend

export const createSell = async (tiendaId: string, cierreId: string, usuarioId: string, total: number, totalcash: number, totaltransfer: number, productos: IProductoVenta[] ) => {
  const response = await axios.post(API_URL(tiendaId, cierreId), { 
    usuarioId,
    total,
    totalcash,
    totaltransfer,
    productos
  });
  return response.data;
} 