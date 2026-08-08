import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

export type CategoryMarginRow = {
  categoryId: string | null;
  categoryName: string;
  categoryColor: string | null;
  unidades: number;
  ventasNetas: number;
  costo: number;
  ganancia: number;
  margenPorcentaje: number;
  /** Share of the period's total profit, as a percentage. */
  contribucionPorcentaje: number;
};

/** Sales and margin grouped by product category. */
export function createCategoryMarginAggregator(): SalesAggregator<
  CategoryMarginRow[]
> {
  const byCategory = new Map<string, CategoryMarginRow>();

  return {
    consume(sale: NormalizedSale) {
      for (const line of sale.lines) {
        const key = line.dimension?.categoryId ?? "__sin_categoria__";
        let row = byCategory.get(key);

        if (!row) {
          row = {
            categoryId: line.dimension?.categoryId ?? null,
            categoryName: line.dimension?.categoryName ?? "Sin categoría",
            categoryColor: line.dimension?.categoryColor ?? null,
            unidades: 0,
            ventasNetas: 0,
            costo: 0,
            ganancia: 0,
            margenPorcentaje: 0,
            contribucionPorcentaje: 0,
          };
          byCategory.set(key, row);
        }

        row.unidades += line.quantity;
        row.ventasNetas += line.netAmount;
        row.costo += line.costAmount;
        row.ganancia += line.netProfit;
      }
    },
    finalize() {
      const rows = Array.from(byCategory.values());
      // Only positive profit contributes to the share, so loss-making
      // categories cannot inflate the others past 100%.
      const totalProfit = rows.reduce(
        (acc, row) => acc + Math.max(0, row.ganancia),
        0,
      );

      for (const row of rows) {
        row.margenPorcentaje =
          row.ventasNetas > 0 ? (row.ganancia / row.ventasNetas) * 100 : 0;
        row.contribucionPorcentaje =
          totalProfit > 0 ? (Math.max(0, row.ganancia) / totalProfit) * 100 : 0;
      }

      return rows.sort((a, b) => b.ganancia - a.ganancia);
    },
  };
}
