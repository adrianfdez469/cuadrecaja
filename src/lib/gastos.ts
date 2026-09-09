import { convertToBase, resolveSnapshotFromHistory } from "./currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { TasaHistoryRecord } from "@/lib/cierre/computeCierreTotals";

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

export interface PercentageBaseSale {
  createdAt: Date;
  frontendCreatedAt: Date | null;
  discountTotal: number | null;
  tasaSnapshot: ITasaSnapshot | null;
  productos: {
    cantidad: number;
    precio: number;
    costo: number;
    monedaPrecioCode: string | null;
    monedaCostoCode: string | null;
  }[];
}

export interface PercentageBaseTotals {
  /** Gross minus discount, floored at zero per sale. */
  totalVentas: number;
  /** Sum of (price - cost) x quantity. Gross of discounts, deliberately. */
  totalGanancia: number;
}

/**
 * The two totals a percentage expense is a percentage OF, exactly as the
 * expenses preview has always computed them — moved here verbatim so both
 * routes read one definition instead of two.
 *
 * NOT the same arithmetic as computeCierreTotals: that one's totalGanancia is
 * net of discounts and this one is gross. Changing which of the two rules the
 * expenses use would move real money and is out of F-029's scope; this contract
 * only changes WHICH SALES it runs over.
 */
export function computePercentageBaseTotals(
  ventas: readonly PercentageBaseSale[],
  monedaBase: string,
  historialTasas: TasaHistoryRecord[],
): PercentageBaseTotals {
  let totalVentas = 0;
  let totalGanancia = 0;

  for (const venta of ventas) {
    // The sale's own snapshot first; its gaps filled with the rate in force
    // when it happened, never a silent 1.
    const tasas = resolveSnapshotFromHistory(
      historialTasas,
      venta.tasaSnapshot,
      venta.frontendCreatedAt ?? venta.createdAt,
    );
    let ventaBruta = 0;

    for (const vp of venta.productos) {
      const precioBase = convertToBase(
        vp.precio,
        vp.monedaPrecioCode ?? monedaBase,
        tasas,
        monedaBase,
      );
      const costoBase = convertToBase(
        vp.costo,
        vp.monedaCostoCode ?? monedaBase,
        tasas,
        monedaBase,
      );
      ventaBruta += vp.cantidad * precioBase;
      totalGanancia += vp.cantidad * (precioBase - costoBase);
    }

    const descuento = Number(venta.discountTotal ?? 0);
    totalVentas += Math.max(0, ventaBruta - descuento);
  }

  return { totalVentas, totalGanancia };
}
