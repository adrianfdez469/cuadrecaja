import { Sale } from "@/store/salesStore";
import { ITicketPlantilla } from "@/schemas/ticketPlantilla";
import { ITicketPayload, IPrintSaleContext } from "../types/ITicketData";
import { convertToBase } from "@/lib/currency";
import {
  formatTicketDateFull,
  shortTicketId,
} from "./ticketLayout";

function collectMonedasUsadas(
  sale: Sale,
  monedaBase: string,
  options: { excludeMonedaBase?: boolean; excludeCup?: boolean } = {},
): string[] {
  const { excludeMonedaBase = false, excludeCup = false } = options;
  const set = new Set<string>();

  const maybeAdd = (code: string) => {
    if (excludeCup && code === "CUP") return;
    if (excludeMonedaBase && code === monedaBase) return;
    set.add(code);
  };

  for (const p of sale.productos) {
    maybeAdd(p.monedaPrecioCode ?? monedaBase);
  }

  for (const pago of sale.pagosDetalle ?? []) {
    maybeAdd(pago.moneda);
  }

  for (const v of sale.vueltoDetalle ?? []) {
    maybeAdd(v.moneda);
  }

  return [...set].sort();
}

export function buildTicketPayload(
  sale: Sale,
  plantilla: ITicketPlantilla,
  context: IPrintSaleContext,
): ITicketPayload {
  const monedaBase = context.monedaBase;
  const tasas = sale.tasaSnapshot ?? {};

  const productos = sale.productos.map((p) => ({
    cantidad: p.cantidad,
    nombre: p.name,
    precioUnitario: p.price,
    subtotal: p.price * p.cantidad,
    monedaPrecioCode: p.monedaPrecioCode,
  }));

  const subtotalBase = productos.reduce(
    (sum, p) =>
      sum +
      convertToBase(
        p.subtotal,
        p.monedaPrecioCode ?? monedaBase,
        tasas,
        monedaBase,
      ),
    0,
  );

  const discountTotal =
    plantilla.mostrarDescuentos && sale.discountTotal != null && sale.discountTotal > 0
      ? sale.discountTotal
      : undefined;

  return {
    tiendaNombre: context.tiendaNombre,
    negocioNombre: context.negocioNombre,
    cajeroNombre: plantilla.mostrarCajero ? context.cajeroNombre : undefined,
    ticketId: shortTicketId(sale.identifier),
    fechaCompleta: formatTicketDateFull(sale.createdAt),
    productos,
    subtotalBase,
    total: sale.total,
    totalCash: sale.totalcash,
    totalTransfer: sale.totaltransfer,
    discountTotal,
    discountCodes:
      plantilla.mostrarDescuentos && sale.discountCodes?.length
        ? sale.discountCodes
        : undefined,
    pagosDetalle: plantilla.mostrarMultimoneda ? sale.pagosDetalle : undefined,
    vueltoDetalle: plantilla.mostrarMultimoneda ? sale.vueltoDetalle : undefined,
    monedaCobro: sale.monedaCobro,
    tasaSnapshot: sale.tasaSnapshot,
    monedasUsadasEnVenta: collectMonedasUsadas(sale, monedaBase, {
      excludeMonedaBase: true,
      excludeCup: false,
    }),
    monedasParaTasas: collectMonedasUsadas(sale, monedaBase, {
      excludeMonedaBase: false,
      excludeCup: true,
    }),
    plantilla,
    monedaBase,
  };
}
