import type { IVenta } from "@/schemas/venta";

type VentaProductoRow = {
  id: string;
  cantidad: number;
  productoTiendaId: string;
  precio: number;
  costo?: number;
  monedaPrecioCode?: string | null;
  producto: {
    proveedor: { id: string; nombre: string } | null;
    producto: { nombre: string; id: string };
  };
};

type VentaPrismaRow = {
  id: string;
  createdAt: Date;
  total: number;
  totalcash: number;
  totaltransfer: number;
  discountTotal: unknown;
  tiendaId: string;
  usuarioId: string;
  cierrePeriodoId: string;
  syncId: string | null;
  wasOffline?: boolean;
  monedaCobro?: string | null;
  pagosDetalle?: unknown;
  vueltoDetalle?: unknown;
  tasaSnapshot?: unknown;
  transferDestinationId?: string | null;
  transferDestination?: { id: string; nombre: string } | null;
  usuario: { id: string; nombre: string };
  productos: VentaProductoRow[];
  appliedDiscounts?: Array<{
    id: string;
    discountRuleId: string;
    ventaId: string;
    amount: number;
    productsAffected: unknown;
    createdAt: Date;
    discountRule?: { name: string } | null;
  }>;
};

function mapProductoNombre(p: VentaProductoRow): string | undefined {
  const nombre = p.producto?.producto?.nombre;
  if (!nombre) return undefined;
  return p.producto.proveedor
    ? `${nombre} - ${p.producto.proveedor.nombre}`
    : nombre;
}

export function mapVentaToIVenta(venta: VentaPrismaRow): IVenta {
  return {
    id: venta.id,
    createdAt: venta.createdAt,
    total: venta.total,
    totalcash: venta.totalcash,
    totaltransfer: venta.totaltransfer,
    discountTotal: Number(venta.discountTotal ?? 0),
    tiendaId: venta.tiendaId,
    usuarioId: venta.usuarioId,
    cierrePeriodoId: venta.cierrePeriodoId,
    usuario: {
      id: venta.usuario.id,
      nombre: venta.usuario.nombre,
      usuario: "",
      rol: "",
    },
    productos: venta.productos.map((p) => ({
      id: p.producto.producto.id,
      ventaProductoId: p.id,
      ventaId: venta.id,
      productoTiendaId: p.productoTiendaId,
      cantidad: p.cantidad,
      name: mapProductoNombre(p),
      price: p.precio ?? undefined,
      monedaPrecioCode: p.monedaPrecioCode ?? undefined,
    })),
    appliedDiscounts: (venta.appliedDiscounts || []).map((ad) => ({
      id: ad.id,
      discountRuleId: ad.discountRuleId,
      ventaId: ad.ventaId,
      amount: ad.amount,
      productsAffected: ad.productsAffected as
        { productoTiendaId: string; cantidad: number }[] | undefined,
      createdAt: ad.createdAt,
      ruleName: ad.discountRule?.name,
    })),
    syncId: venta.syncId ?? undefined,
    transferDestinationId: venta.transferDestinationId ?? undefined,
    transferDestination: venta.transferDestination ?? undefined,
    monedaCobro: venta.monedaCobro ?? undefined,
    pagosDetalle: (venta.pagosDetalle as IVenta["pagosDetalle"]) ?? undefined,
    vueltoDetalle:
      (venta.vueltoDetalle as IVenta["vueltoDetalle"]) ?? undefined,
    tasaSnapshot: (venta.tasaSnapshot as IVenta["tasaSnapshot"]) ?? undefined,
  };
}

export function mapMultimonedaFields(venta: VentaPrismaRow) {
  return {
    monedaCobro: venta.monedaCobro ?? undefined,
    pagosDetalle: (venta.pagosDetalle as IVenta["pagosDetalle"]) ?? undefined,
    vueltoDetalle:
      (venta.vueltoDetalle as IVenta["vueltoDetalle"]) ?? undefined,
    tasaSnapshot: (venta.tasaSnapshot as IVenta["tasaSnapshot"]) ?? undefined,
  };
}
