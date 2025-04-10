import axios from "axios";
import { cretateBatchMovimientos } from "./movimientoService";

interface IProductoVenta {
  productoTiendaId: string;
  cantidad: number;
  productId
}


const API_URL = (tiendaId, cierreId) => `/api/venta/${tiendaId}/${cierreId}`; // Ruta base del backend

export const createSell = async (tiendaId: string, cierreId: string, usuarioId: string, total: number, totalcash: number, totaltransfer: number, productos: IProductoVenta[] ) => {
  
  const response = await axios.post(API_URL(tiendaId, cierreId), { 
    usuarioId,
    total,
    totalcash,
    totaltransfer,
    productos
  });

  await cretateBatchMovimientos(
    { tiendaId, usuarioId, tipo: 'VENTA'},
    productos.map(p => {
      return {
        cantidad: p.cantidad,
        productoId: p.productId
      }
    })
  )

  return response.data;
} 