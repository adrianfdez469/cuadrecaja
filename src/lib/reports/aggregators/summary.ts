import { SALE_ORIGINS } from "@/constants/venta";
import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

/** The origin whose sales this summary counts apart (ADR 0075). */
const TIENDA_ONLINE_ORIGIN = SALE_ORIGINS[1];

export type SalesSummary = {
  /** Net of discounts, in base currency. */
  totalPeriodo: number;
  /** Before discounts, in base currency. */
  totalBruto: number;
  totalDescuentos: number;
  unidadesVendidas: number;
  gananciaTotal: number;
  cantidadVentas: number;
  costoMercanciaVendida: number;
  /** How many sales of the range landed from an online order. Unchanged. */
  cantidadVentasTiendaOnline: number;
  /**
   * Merchandise of those sales, net of discounts, in base currency. RENAMED
   * from `totalTiendaOnline`, same computation (ADR 0090): the old name read as
   * "everything the channel billed" and never included delivery.
   *
   * PART of `totalPeriodo`, not a sum on top of it.
   */
  totalMercanciaTiendaOnline: number;
  /**
   * Delivery charged by those sales, in base currency (ADR 0089).
   *
   * OUTSIDE `totalPeriodo`: `netAmount` never carried it. Surfacing it changes
   * no existing figure, so the closing is untouched.
   */
  totalEnvioTiendaOnline: number;
  /** How many of those sales charged for delivery at all. */
  cantidadVentasTiendaOnlineConEnvio: number;
};

/** Headline totals of a range — the numbers behind the dashboard KPI row. */
export function createSummaryAggregator(): SalesAggregator<SalesSummary> {
  const summary: SalesSummary = {
    totalPeriodo: 0,
    totalBruto: 0,
    totalDescuentos: 0,
    unidadesVendidas: 0,
    gananciaTotal: 0,
    cantidadVentas: 0,
    costoMercanciaVendida: 0,
    cantidadVentasTiendaOnline: 0,
    totalMercanciaTiendaOnline: 0,
    totalEnvioTiendaOnline: 0,
    cantidadVentasTiendaOnlineConEnvio: 0,
  };

  return {
    consume(sale: NormalizedSale) {
      summary.totalPeriodo += sale.netAmount;
      summary.totalBruto += sale.grossAmount;
      summary.totalDescuentos += sale.discountTotal;
      summary.cantidadVentas += 1;

      if (sale.origen === TIENDA_ONLINE_ORIGIN) {
        summary.cantidadVentasTiendaOnline += 1;
        summary.totalMercanciaTiendaOnline += sale.netAmount;
        summary.totalEnvioTiendaOnline += sale.deliveryFeeBase;
        if (sale.deliveryFeeBase > 0) {
          summary.cantidadVentasTiendaOnlineConEnvio += 1;
        }
      }

      for (const line of sale.lines) {
        summary.unidadesVendidas += line.quantity;
        summary.gananciaTotal += line.netProfit;
        summary.costoMercanciaVendida += line.costAmount;
      }
    },
    finalize() {
      return summary;
    },
  };
}
