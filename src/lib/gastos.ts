import { convertToBase } from "./currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

type ResumenEntry = {
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
};

/**
 * Fórmula única de "ganancia final" de un período — antes reimplementada de
 * forma independiente en cada endpoint (preview, apply, close, resumen,
 * summary, dashboard), lo que permitía que un endpoint quedara desactualizado
 * respecto a los demás (ej. preview no restaba merma/devoluciones).
 */
export function calcularGananciaFinal(
  totalGanancia: number,
  totalGastos: number,
  totalMerma: number = 0,
  totalDevoluciones: number = 0,
): number {
  return totalGanancia - totalGastos - totalMerma - totalDevoluciones;
}

export function applyGastosToResumenMap(
  map: Record<string, ResumenEntry>,
  gastos: {
    tipoCalculo: string;
    montoCalculado: number;
    monedaCode?: string | null;
  }[],
  monedaBase: string,
  tasas: ITasaSnapshot,
): void {
  for (const g of gastos) {
    const moneda = g.monedaCode ?? monedaBase;
    const enBase = convertToBase(g.montoCalculado, moneda, tasas, monedaBase);
    if (!map[moneda])
      map[moneda] = { totalEfectivo: 0, totalTransfer: 0, equivalenteBase: 0 };
    map[moneda].totalEfectivo -= g.montoCalculado;
    map[moneda].equivalenteBase -= enBase;
  }
}
