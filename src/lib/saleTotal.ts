import { convertToBase } from "@/lib/currency";
import { SALE_TOTAL_TOLERANCE_BASE } from "@/constants/venta";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export interface ISaleLineForTotal {
  precio: number | null | undefined;
  cantidad: number | null | undefined;
  monedaPrecioCode?: string | null;
}

export interface ISaleTotalReconciliation {
  /** The total to persist. */
  total: number;
  /** What the client reported, normalized to a number. */
  clientTotal: number;
  /** Server total minus client total. */
  delta: number;
  /** True when the client's figure was discarded. */
  diverged: boolean;
}

/** Unit price of a line expressed in monedaBase. */
export function linePriceInBase(
  line: Pick<ISaleLineForTotal, "precio" | "monedaPrecioCode">,
  tasas: ITasaSnapshot,
  monedaBase: string,
): number {
  return convertToBase(
    Number(line.precio) || 0,
    line.monedaPrecioCode ?? monedaBase,
    tasas,
    monedaBase,
  );
}

/**
 * Gross total of a sale in monedaBase: Σ price × quantity, each line converted
 * from its own price currency. Discounts are not applied here.
 */
export function grossTotalBase(
  lines: ISaleLineForTotal[],
  tasas: ITasaSnapshot,
  monedaBase: string,
): number {
  return lines.reduce(
    (sum, line) =>
      sum +
      linePriceInBase(line, tasas, monedaBase) * (Number(line.cantidad) || 0),
    0,
  );
}

/**
 * Decides which total a sale is persisted with.
 *
 * The server's figure always wins; the client's is only compared against it so
 * a divergence can be logged. Clients have been seen summing prices across
 * currencies as if they were one (a 15 300 CUP basket stored as 15 300 USD),
 * and a total the books carry has to come from the same prices and rates the
 * sale lines are persisted with.
 */
export function reconcileSaleTotal(
  clientTotal: unknown,
  serverTotal: number,
  tolerance = SALE_TOTAL_TOLERANCE_BASE,
): ISaleTotalReconciliation {
  const reported = Math.max(0, Number(clientTotal) || 0);
  const total = Math.max(0, serverTotal);
  const delta = total - reported;
  return {
    total,
    clientTotal: reported,
    delta,
    diverged: Math.abs(delta) > tolerance,
  };
}
