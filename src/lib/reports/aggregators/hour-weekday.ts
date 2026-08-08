import type { SalesAggregator } from "./index";
import type { NormalizedSale } from "../sales-stream";

export type HourWeekdayCell = {
  /** 0 = Monday … 6 = Sunday, matching how the heatmap is laid out. */
  weekday: number;
  hour: number;
  ventasNetas: number;
  transacciones: number;
};

export type HourWeekdayResult = {
  cells: HourWeekdayCell[];
  maxVentas: number;
  /** Busiest slot by revenue, or null when there were no sales. */
  pico: { weekday: number; hour: number; ventasNetas: number } | null;
};

const WEEKDAYS = 7;
const HOURS = 24;

/**
 * Revenue laid out as weekday × hour.
 *
 * Uses the POS timestamp when present, so the peaks reflect when customers
 * actually bought rather than when an offline sale happened to sync.
 */
export function createHourWeekdayAggregator(): SalesAggregator<HourWeekdayResult> {
  // Dense fixed-size grid: 168 slots regardless of sales volume.
  const grid: HourWeekdayCell[] = [];
  for (let weekday = 0; weekday < WEEKDAYS; weekday += 1) {
    for (let hour = 0; hour < HOURS; hour += 1) {
      grid.push({ weekday, hour, ventasNetas: 0, transacciones: 0 });
    }
  }

  return {
    consume(sale: NormalizedSale) {
      const date = sale.soldAt;
      // getDay(): 0 = Sunday. Shift so Monday leads the week.
      const weekday = (date.getDay() + 6) % 7;
      const cell = grid[weekday * HOURS + date.getHours()];
      cell.ventasNetas += sale.netAmount;
      cell.transacciones += 1;
    },
    finalize() {
      let maxVentas = 0;
      let pico: HourWeekdayResult["pico"] = null;

      for (const cell of grid) {
        if (cell.ventasNetas > maxVentas) {
          maxVentas = cell.ventasNetas;
          pico = {
            weekday: cell.weekday,
            hour: cell.hour,
            ventasNetas: cell.ventasNetas,
          };
        }
      }

      return { cells: grid, maxVentas, pico };
    },
  };
}
