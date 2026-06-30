import { Sale } from "@/store/salesStore";
import { ITicketPlantilla } from "@/schemas/ticketPlantilla";
import { ITicketPayload, IPrintSaleContext } from "../types/ITicketData";
import { compactProductName } from "./compactProductName";
import {
  formatTicketDate,
  getMaxProductNameChars,
  shortTicketId,
} from "./ticketLayout";

export function buildTicketPayload(
  sale: Sale,
  plantilla: ITicketPlantilla,
  context: IPrintSaleContext,
): ITicketPayload {
  const ancho = (plantilla.anchoPapel === 80 ? 80 : 58) as 58 | 80;
  const maxNameChars = getMaxProductNameChars(ancho);

  const productos = sale.productos.map((p) => ({
    cantidad: p.cantidad,
    nombreCompacto: compactProductName(p.name, maxNameChars),
    subtotal: p.price * p.cantidad,
    monedaPrecioCode: p.monedaPrecioCode,
  }));

  return {
    tiendaNombre: context.tiendaNombre,
    negocioNombre: context.negocioNombre,
    cajeroNombre: plantilla.mostrarCajero ? context.cajeroNombre : undefined,
    ticketId: shortTicketId(sale.identifier),
    fechaCompacta: formatTicketDate(sale.createdAt),
    productos,
    total: sale.total,
    totalCash: sale.totalcash,
    totalTransfer: sale.totaltransfer,
    discountCodes:
      plantilla.mostrarDescuentos && sale.discountCodes?.length
        ? sale.discountCodes
        : undefined,
    pagosDetalle: plantilla.mostrarMultimoneda ? sale.pagosDetalle : undefined,
    vueltoDetalle: plantilla.mostrarMultimoneda ? sale.vueltoDetalle : undefined,
    monedaCobro: sale.monedaCobro,
    plantilla,
    monedaBase: context.monedaBase,
  };
}
