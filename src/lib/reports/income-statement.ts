import { prisma } from "@/lib/prisma";
import { convertToBase } from "@/lib/currency";
import { calcularGananciaFinal } from "@/lib/gastos";
import type { ReportScope } from "./scope";
import type { SalesSummary } from "./aggregators/summary";
import type { ClosingDeductions } from "./closing-totals";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export type ExpenseLine = {
  categoria: string;
  naturaleza: "OPERATIVO" | "INVERSION";
  monto: number;
  cantidad: number;
};

export type IncomeStatement = {
  ventasBrutas: number;
  descuentos: number;
  ventasNetas: number;
  costoMercanciaVendida: number;
  margenBruto: number;
  margenBrutoPorcentaje: number;
  /** OPERATIVO only — the closing's own definition of what reduces profit. */
  gastosOperativos: number;
  gastosPorCategoria: ExpenseLine[];
  /** INVERSION expenses: they consume cash but never reduce profit. */
  gastosInversion: number;
  inversionPorCategoria: ExpenseLine[];
  merma: number;
  devoluciones: number;
  gananciaFinal: number;
  /** Non-zero only if the category breakdown fails to reconcile with the closings. */
  ajusteConciliacion: number;
};

type RateHistoryEntry = { monedaCode: string; tasa: number; createdAt: Date };

/**
 * Exchange rates as they stood at a given moment.
 *
 * Closing totals were computed with the rates in force when the period closed,
 * so reproducing a breakdown that adds up to them requires the same rates —
 * today's would drift.
 */
function ratesAt(history: RateHistoryEntry[], at: Date): ITasaSnapshot {
  const snapshot: ITasaSnapshot = {};
  for (const entry of history) {
    if (entry.createdAt > at) break; // history is sorted ascending
    if (entry.monedaCode === "CUP") continue;
    snapshot[entry.monedaCode] = entry.tasa;
  }
  return snapshot;
}

function addExpense(
  target: Map<string, ExpenseLine>,
  categoria: string,
  naturaleza: "OPERATIVO" | "INVERSION",
  monto: number,
): void {
  const existing = target.get(categoria);
  if (existing) {
    existing.monto += monto;
    existing.cantidad += 1;
  } else {
    target.set(categoria, { categoria, naturaleza, monto, cantidad: 1 });
  }
}

/**
 * Builds the period's profit-and-loss statement.
 *
 * Deliberately anchored to the values already denormalized on `CierrePeriodo`
 * rather than recomputing them, so the statement always agrees with what the
 * user sees in the closings summary. Only the per-category breakdown is derived
 * from `GastoCierre`.
 */
export async function buildIncomeStatement(
  scope: ReportScope,
  summary: SalesSummary,
  deductions: ClosingDeductions,
  closingIds: string[],
): Promise<IncomeStatement> {
  const operativos = new Map<string, ExpenseLine>();
  const inversiones = new Map<string, ExpenseLine>();
  let breakdownOperativo = 0;
  let gastosInversion = 0;

  if (closingIds.length > 0) {
    const [gastos, history] = await Promise.all([
      prisma.gastoCierre.findMany({
        where: { cierreId: { in: closingIds } },
        select: {
          categoria: true,
          naturaleza: true,
          montoCalculado: true,
          monedaCode: true,
          cierre: { select: { fechaFin: true } },
        },
      }),
      scope.negocioId
        ? prisma.tasaCambio.findMany({
            where: { negocioId: scope.negocioId },
            orderBy: { createdAt: "asc" },
            select: { monedaCode: true, tasa: true, createdAt: true },
          })
        : Promise.resolve([] as RateHistoryEntry[]),
    ]);

    for (const gasto of gastos) {
      const moneda = gasto.monedaCode ?? scope.baseCurrency;
      const at = gasto.cierre?.fechaFin ?? scope.range.to;
      const monto = convertToBase(
        gasto.montoCalculado,
        moneda,
        ratesAt(history, at),
        scope.baseCurrency,
      );

      if (gasto.naturaleza === "OPERATIVO") {
        addExpense(operativos, gasto.categoria, "OPERATIVO", monto);
        breakdownOperativo += monto;
      } else {
        addExpense(inversiones, gasto.categoria, "INVERSION", monto);
        gastosInversion += monto;
      }
    }
  }

  const ventasBrutas = summary.totalBruto;
  const descuentos = summary.totalDescuentos;
  const ventasNetas = summary.totalPeriodo;
  const costoMercanciaVendida = summary.costoMercanciaVendida;
  const margenBruto = summary.gananciaTotal;

  const gastosOperativos = deductions.totalGastos;
  const gananciaFinal = calcularGananciaFinal(
    margenBruto,
    gastosOperativos,
    deductions.totalMerma,
    deductions.totalDevoluciones,
  );

  const ajusteConciliacion = gastosOperativos - breakdownOperativo;

  return {
    ventasBrutas,
    descuentos,
    ventasNetas,
    costoMercanciaVendida,
    margenBruto,
    margenBrutoPorcentaje:
      ventasNetas > 0 ? (margenBruto / ventasNetas) * 100 : 0,
    gastosOperativos,
    gastosPorCategoria: Array.from(operativos.values()).sort(
      (a, b) => b.monto - a.monto,
    ),
    gastosInversion,
    inversionPorCategoria: Array.from(inversiones.values()).sort(
      (a, b) => b.monto - a.monto,
    ),
    merma: deductions.totalMerma,
    devoluciones: deductions.totalDevoluciones,
    gananciaFinal,
    ajusteConciliacion:
      Math.abs(ajusteConciliacion) > 0.01 ? ajusteConciliacion : 0,
  };
}
