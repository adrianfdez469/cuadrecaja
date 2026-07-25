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

  // Cada línea se convierte a la moneda base para que la columna de importes
  // del ticket sume exactamente al Subtotal / TOTAL <base> (evita mezclar
  // monedas crudas, p. ej. 14 USD junto a 4.500 CUP en la misma columna).
  const productos = sale.productos.map((p) => {
    const moneda = p.monedaPrecioCode ?? monedaBase;
    return {
      cantidad: p.cantidad,
      nombre: p.name,
      precioUnitario: convertToBase(p.price, moneda, tasas, monedaBase),
      subtotal: convertToBase(p.price * p.cantidad, moneda, tasas, monedaBase),
      monedaPrecioCode: monedaBase, // ya normalizado a base
    };
  });

  const subtotalBase = productos.reduce((sum, p) => sum + p.subtotal, 0);

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
