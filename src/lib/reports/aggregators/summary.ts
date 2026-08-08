import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

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
  };

  return {
    consume(sale: NormalizedSale) {
      summary.totalPeriodo += sale.netAmount;
      summary.totalBruto += sale.grossAmount;
      summary.totalDescuentos += sale.discountTotal;
      summary.cantidadVentas += 1;

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
