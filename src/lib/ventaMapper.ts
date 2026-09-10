import {
  summarizeVentaCobros,
  type IVentaCobroRow,
} from "@/lib/cuentasPorCobrar/ventaCreditoEstado";
import type { IVentaCreditoResumen } from "@/schemas/ventaCredito";
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
  tipTotal?: unknown;
  tipDetail?: unknown;
  transferDestinationId?: string | null;
  transferDestination?: { id: string; nombre: string } | null;
  creditoBase?: number | null;
  clienteId?: string | null;
  cliente?: { id: string; nombre: string } | null;
  /**
   * Present only when the caller's `include` asked for it. The three callers of today
   * (api/app/venta/**, api/cuentas-por-cobrar/cliente/[clienteId]) do not, and keep compiling
   * unchanged: `credito` then comes out null and their screens read the sale as they do now.
   */
  cuentaPorCobrar?: {
    id: string;
    montoOriginal: number;
    saldoPendiente: number;
    settledAt: Date | null;
    movimientos: IVentaCobroRow[];
  } | null;
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

/**
 * The credit block of a serialized sale, or `null` when the sale has no CuentaPorCobrar.
 *
 * EXPORTED on purpose: the listing GET of F-032 builds the same block for the same sales
 * (contract § 1.3). If each one assembled it its own way, the chip of `/ventas` and the chip of
 * the mobile app could disagree about the very same sale.
 *
 * `summarizeVentaCobros` is the only definition of "how many collections and for how much"
 * (E-039): it is imported, not restated.
 */
export function buildVentaCreditoResumen(
  cuenta: VentaPrismaRow["cuentaPorCobrar"],
): IVentaCreditoResumen | null {
  if (!cuenta) return null;

  const resumen = summarizeVentaCobros(cuenta.movimientos ?? []);

  return {
    cuentaId: cuenta.id,
    montoOriginal: Number(cuenta.montoOriginal ?? 0),
    saldoPendiente: Number(cuenta.saldoPendiente ?? 0),
    settledAt: cuenta.settledAt ?? null,
    cobros: resumen.cobros,
    cobrosMontoBase: resumen.cobrosMontoBase,
    movimientos: resumen.movimientos,
  };
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
    tipTotal: Number(venta.tipTotal ?? 0),
    tipDetail: (venta.tipDetail as IVenta["tipDetail"]) ?? undefined,
    creditoBase: Number(venta.creditoBase ?? 0),
    clienteId: venta.clienteId ?? undefined,
    clienteNombre: venta.cliente?.nombre ?? undefined,
    credito: buildVentaCreditoResumen(venta.cuentaPorCobrar),
  };
}

/**
 * `mapMultimonedaFields` does NOT change: it returns neither totals nor credit today, and no
 * criterion asks it to.
 */
export function mapMultimonedaFields(venta: VentaPrismaRow) {
  return {
    monedaCobro: venta.monedaCobro ?? undefined,
    pagosDetalle: (venta.pagosDetalle as IVenta["pagosDetalle"]) ?? undefined,
    vueltoDetalle:
      (venta.vueltoDetalle as IVenta["vueltoDetalle"]) ?? undefined,
    tasaSnapshot: (venta.tasaSnapshot as IVenta["tasaSnapshot"]) ?? undefined,
    tipTotal: Number(venta.tipTotal ?? 0),
    tipDetail: (venta.tipDetail as IVenta["tipDetail"]) ?? undefined,
  };
}
