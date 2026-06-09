import { convertToBase } from "./currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

type ResumenEntry = {
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
};

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
