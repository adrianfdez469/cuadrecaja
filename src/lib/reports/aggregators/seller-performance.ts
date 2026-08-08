import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

export type SellerPerformanceRow = {
  sellerId: string;
  /** Resolved by the route, which loads the user catalog. */
  nombre: string;
  ventasNetas: number;
  ventasBrutas: number;
  ganancia: number;
  tickets: number;
  unidades: number;
  ticketPromedio: number;
  unidadesPorTicket: number;
  descuentoOtorgado: number;
  /** Discount given as a share of this seller's gross — an outlier flag. */
  descuentoPorcentaje: number;
  participacionPorcentaje: number;
};

/**
 * Per-seller performance, built on `Venta.usuarioId` — a field the reporting
 * has never surfaced despite being recorded on every sale.
 */
export function createSellerPerformanceAggregator(): SalesAggregator<
  SellerPerformanceRow[]
> {
  const bySeller = new Map<string, SellerPerformanceRow>();

  return {
    consume(sale: NormalizedSale) {
      let row = bySeller.get(sale.sellerId);

      if (!row) {
        row = {
          sellerId: sale.sellerId,
          nombre: sale.sellerId,
          ventasNetas: 0,
          ventasBrutas: 0,
          ganancia: 0,
          tickets: 0,
          unidades: 0,
          ticketPromedio: 0,
          unidadesPorTicket: 0,
          descuentoOtorgado: 0,
          descuentoPorcentaje: 0,
          participacionPorcentaje: 0,
        };
        bySeller.set(sale.sellerId, row);
      }

      row.ventasNetas += sale.netAmount;
      row.ventasBrutas += sale.grossAmount;
      row.ganancia += sale.netProfit;
      row.descuentoOtorgado += sale.discountTotal;
      row.tickets += 1;
      for (const line of sale.lines) row.unidades += line.quantity;
    },
    finalize() {
      const rows = Array.from(bySeller.values());
      const totalNeto = rows.reduce((acc, row) => acc + row.ventasNetas, 0);

      for (const row of rows) {
        row.ticketPromedio =
          row.tickets > 0 ? row.ventasNetas / row.tickets : 0;
        row.unidadesPorTicket =
          row.tickets > 0 ? row.unidades / row.tickets : 0;
        row.descuentoPorcentaje =
          row.ventasBrutas > 0
            ? (row.descuentoOtorgado / row.ventasBrutas) * 100
            : 0;
        row.participacionPorcentaje =
          totalNeto > 0 ? (row.ventasNetas / totalNeto) * 100 : 0;
      }

      return rows.sort((a, b) => b.ventasNetas - a.ventasNetas);
    },
  };
}
