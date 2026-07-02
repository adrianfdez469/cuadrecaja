import { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import { ITicketPlantilla } from "@/schemas/ticketPlantilla";

export interface ITicketProductLine {
  cantidad: number;
  nombreCompacto: string;
  subtotal: number;
  monedaPrecioCode?: string | null;
}

export interface ITicketPayload {
  tiendaNombre: string;
  negocioNombre: string;
  cajeroNombre?: string;
  ticketId: string;
  fechaCompacta: string;
  productos: ITicketProductLine[];
  total: number;
  totalCash: number;
  totalTransfer: number;
  discountCodes?: string[];
  pagosDetalle?: IPagoLinea[];
  vueltoDetalle?: IVueltoLinea[];
  monedaCobro?: string;
  plantilla: ITicketPlantilla;
  monedaBase: string;
}

export interface IPrintSaleContext {
  tiendaNombre: string;
  negocioNombre: string;
  cajeroNombre: string;
  monedaBase: string;
}
