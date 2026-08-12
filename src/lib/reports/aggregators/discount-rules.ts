import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

export type DiscountRuleUsage = {
  discountRuleId: string;
  /** Resolved by the route, which knows the rule catalog. */
  nombre: string;
  tipo: string | null;
  vecesAplicado: number;
  montoDescontado: number;
  /** Gross of the lines the rule touched. */
  ventasAfectadas: number;
  /** Share of the affected gross that the discount ate. */
  erosionPorcentaje: number;
};

export type DiscountRulesResult = {
  rows: DiscountRuleUsage[];
  /** Includes legacy discounts with no AppliedDiscount row behind them. */
  totalDescontado: number;
  ventasConDescuento: number;
};

/**
 * Discount usage grouped by rule — how much each promotion gave away and how
 * deeply it cut into the sales it touched.
 */
export function createDiscountRulesAggregator(): SalesAggregator<DiscountRulesResult> {
  const byRule = new Map<string, DiscountRuleUsage>();
  let totalDescontado = 0;
  let ventasConDescuento = 0;

  return {
    consume(sale: NormalizedSale) {
      if (sale.discountTotal > 0) {
        totalDescontado += sale.discountTotal;
        ventasConDescuento += 1;
      }

      for (const [ruleId, totals] of sale.discountsByRule) {
        let row = byRule.get(ruleId);
        if (!row) {
          row = {
            discountRuleId: ruleId,
            nombre: ruleId,
            tipo: null,
            vecesAplicado: 0,
            montoDescontado: 0,
            ventasAfectadas: 0,
            erosionPorcentaje: 0,
          };
          byRule.set(ruleId, row);
        }
        row.vecesAplicado += 1;
        row.montoDescontado += totals.amount;
        row.ventasAfectadas += totals.affectedGross;
      }
    },
    finalize() {
      const rows = Array.from(byRule.values());
      for (const row of rows) {
        row.erosionPorcentaje =
          row.ventasAfectadas > 0
            ? (row.montoDescontado / row.ventasAfectadas) * 100
            : 0;
      }
      return {
        rows: rows.sort((a, b) => b.montoDescontado - a.montoDescontado),
        totalDescontado,
        ventasConDescuento,
      };
    },
  };
}
