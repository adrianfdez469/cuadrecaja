import { IVenta } from "@/schemas/venta";
import { Sale } from "@/store/salesStore";

export function ventaToSale(venta: IVenta): Sale {
  const createdAt = venta.frontendCreatedAt
    ? new Date(venta.frontendCreatedAt).getTime()
    : new Date(venta.createdAt).getTime();

  return {
    identifier: venta.syncId ?? venta.id,
    dbId: venta.id,
    tiendaId: venta.tiendaId,
    cierreId: venta.cierrePeriodoId,
    usuarioId: venta.usuarioId,
    total: venta.total,
    totalcash: venta.totalcash,
    totaltransfer: venta.totaltransfer,
    productos: (venta.productos ?? []).map((p) => ({
      cantidad: p.cantidad,
      productoTiendaId: p.productoTiendaId,
      productId: p.productoTiendaId,
      name: p.name ?? "Producto",
      price: p.price ?? 0,
      monedaPrecioCode: p.monedaPrecioCode,
      ventaProductoId: p.ventaProductoId ?? p.id,
    })),
    synced: true,
    syncState: "synced",
    createdAt,
    wasOffline: venta.wasOffline ?? false,
    syncAttempts: venta.syncAttempts ?? 0,
    transferDestinationId: venta.transferDestinationId,
    monedaCobro: venta.monedaCobro,
    pagosDetalle: venta.pagosDetalle,
    vueltoDetalle: venta.vueltoDetalle,
    tasaSnapshot: venta.tasaSnapshot,
    discountCodes: venta.appliedDiscounts
      ?.map((d) => d.ruleName)
      .filter((n): n is string => !!n),
    discountTotal: venta.discountTotal,
  };
}
