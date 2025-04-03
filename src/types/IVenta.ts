export interface IVenta {
  id: string;
  createdAt: Date;
  productos: VentaProducto[];
  total: number;
  totalcash: number;
  totaltransfer: number;
  tiendaId: string;
  usuarioId: string;
  cierrePeriodoId: string;
}

interface VentaProducto {
  id: string;
  ventaId: string;
  productoTiendaId: string;
  cantidad: number;
}