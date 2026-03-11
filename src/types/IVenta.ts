import { IUser } from "./IUser";

export interface IVenta {
  id: string;
  createdAt: Date;
  total: number;
  totalcash: number;
  totaltransfer: number;
  discountTotal?: number;
  tiendaId: string;
  usuarioId: string;
  cierrePeriodoId: string;
  productos?: VentaProducto[];
  usuario?: IUser;
  syncId?: string;
  // 🆕 NUEVOS CAMPOS
  frontendCreatedAt?: Date;
  wasOffline?: boolean;
  syncAttempts?: number;
  appliedDiscounts?: AppliedDiscount[];
  transferDestinationId?: string;
  transferDestination?: { id: string; nombre: string };
}

interface VentaProducto {
  id: string;
  ventaProductoId?: string; // ID de VentaProducto en DB (para eliminar producto de venta sincronizada)
  ventaId: string;
  productoTiendaId: string;
  cantidad: number;
  name?: string;
  price?: number;
}

export interface AppliedDiscount {
  id: string;
  discountRuleId: string;
  ventaId: string;
  amount: number;
  // Lista de productos impactados por la regla (cuando aplica por PRODUCT o CATEGORY)
  productsAffected?: { productoTiendaId: string; cantidad: number }[];
  createdAt: Date;
  // Nombre de la regla (solo para visualización)
  ruleName?: string;
}