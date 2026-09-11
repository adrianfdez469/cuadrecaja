import { prisma } from "@/lib/prisma";
import { convertToBase } from "@/lib/currency";
import { assembleIncomeStatement } from "./income-statement-assembly";
import type { ReportScope } from "./scope";
import type { SalesSummary } from "./aggregators/summary";
import type { ClosingDeductions } from "./closing-totals";
import type { ExpenseLine, IncomeStatement } from "./income-statement-assembly";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export type { ExpenseLine, IncomeStatement } from "./income-statement-assembly";

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

  return assembleIncomeStatement({
    summary,
    deductions,
    gastosPorCategoria: Array.from(operativos.values()),
    inversionPorCategoria: Array.from(inversiones.values()),
    gastosInversion,
    breakdownOperativo,
  });
}
