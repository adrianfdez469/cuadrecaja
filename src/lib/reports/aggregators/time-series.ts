import { bucketKey } from "../period";
import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";
import type { IReportBucketing } from "@/schemas/reports/common";

export type TimeSeriesPoint = {
  bucket: string;
  ventasNetas: number;
  ganancia: number;
  unidades: number;
  transacciones: number;
};

/**
 * Sales and profit bucketed over time.
 *
 * Buckets are keyed off the real sale timestamp even though the *set* of sales
 * comes from closed periods — so the chart shows the days trading actually
 * happened, not one bar per closing.
 *
 * Granularity is fixed up front so memory stays proportional to the number of
 * buckets, not to the number of sales.
 */
export function createTimeSeriesAggregator(
  bucketing: IReportBucketing,
): SalesAggregator<TimeSeriesPoint[]> {
  const buckets = new Map<string, TimeSeriesPoint>();

  return {
    consume(sale: NormalizedSale) {
      const key = bucketKey(sale.soldAt, bucketing);
      let point = buckets.get(key);

      if (!point) {
        point = {
          bucket: key,
          ventasNetas: 0,
          ganancia: 0,
          unidades: 0,
          transacciones: 0,
        };
        buckets.set(key, point);
      }

      point.ventasNetas += sale.netAmount;
      point.ganancia += sale.netProfit;
      point.transacciones += 1;
      for (const line of sale.lines) point.unidades += line.quantity;
    },
    finalize() {
      return Array.from(buckets.values()).sort((a, b) =>
        a.bucket.localeCompare(b.bucket),
      );
    },
  };
}
