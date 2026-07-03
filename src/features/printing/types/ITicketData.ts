import { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { ITasaSnapshot } from "@/schemas/tasaCambio";
import { ITicketPlantilla } from "@/schemas/ticketPlantilla";

export interface ITicketProductLine {
  cantidad: number;
  nombre: string;
  precioUnitario: number;
  subtotal: number;
  monedaPrecioCode?: string | null;
}

export interface ITicketPayload {
  tiendaNombre: string;
  negocioNombre: string;
  cajeroNombre?: string;
  ticketId: string;
  fechaCompleta: string;
  productos: ITicketProductLine[];
  subtotalBase: number;
  total: number;
  totalCash: number;
  totalTransfer: number;
  discountTotal?: number;
  discountCodes?: string[];
  pagosDetalle?: IPagoLinea[];
  vueltoDetalle?: IVueltoLinea[];
  monedaCobro?: string;
  tasaSnapshot?: ITasaSnapshot;
  monedasUsadasEnVenta: string[];
  /** Monedas usadas en la venta para bloque de tasas (incluye moneda base, excluye CUP) */
  monedasParaTasas: string[];
  plantilla: ITicketPlantilla;
  monedaBase: string;
}

export interface IPrintSaleContext {
  tiendaNombre: string;
  negocioNombre: string;
  cajeroNombre: string;
  monedaBase: string;
}

export interface ITicketTextLine {
  kind: "text";
  text: string;
  align: "left" | "center";
}

export interface ITicketQrLine {
  kind: "qr";
  url: string;
  align: "center";
}

export type ITicketRenderedLine = ITicketTextLine | ITicketQrLine;
