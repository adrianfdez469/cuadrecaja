import { describe, it, expect } from "vitest";
import { assembleIncomeStatement } from "@/lib/reports/income-statement-assembly";
import type {
  ExpenseLine,
  IncomeStatement,
  IncomeStatementAssemblyInput,
} from "@/lib/reports/income-statement-assembly";
import type { ClosingCreditFlow } from "@/lib/reports/closing-totals";
import type { SalesSummary } from "@/lib/reports/aggregators/summary";

/**
 * F-037 (spec criteria 5, 6; contract § 3.2, § 3.4, § 8.3.B; ADR 0121, 0133).
 *
 * `assembleIncomeStatement` is pure — no database, no clock, no rates (§ 3.2) —
 * which is exactly what makes P1/P2/P3 verifiable without a seeded scenario.
 * `buildIncomeStatement` itself stays out of reach of this suite (imports
 * `@/lib/prisma`, § 8.2): that end-to-end wiring is QA's, executed in the
 * browser against Escenario C.
 */

function makeSummary(overrides: Partial<SalesSummary> = {}): SalesSummary {
  return {
    totalPeriodo: 2000,
    totalBruto: 2000,
    totalDescuentos: 0,
    unidadesVendidas: 2,
    gananciaTotal: 1200,
    cantidadVentas: 2,
    costoMercanciaVendida: 800,
    cantidadVentasTiendaOnline: 0,
    totalMercanciaTiendaOnline: 0,
    totalEnvioTiendaOnline: 0,
    cantidadVentasTiendaOnlineConEnvio: 0,
    ...overrides,
  };
}

function makeCredito(
  overrides: Partial<ClosingCreditFlow> = {},
): ClosingCreditFlow {
  return { otorgado: 0, cobrado: 0, ...overrides };
}

function makeExpenseLine(overrides: Partial<ExpenseLine> = {}): ExpenseLine {
  return {
    categoria: "otros",
    naturaleza: "OPERATIVO",
    monto: 0,
    cantidad: 1,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<IncomeStatementAssemblyInput> = {},
): IncomeStatementAssemblyInput {
  return {
    summary: makeSummary(),
    deductions: {
      totalGastos: 0,
      totalMerma: 0,
      totalDevoluciones: 0,
      credito: makeCredito(),
    },
    gastosPorCategoria: [],
    inversionPorCategoria: [],
    gastosInversion: 0,
    breakdownOperativo: 0,
    ...overrides,
  };
}

/** Every field of IncomeStatement EXCEPT the two credit fields (P1). */
function withoutCreditFields(
  statement: IncomeStatement,
): Omit<IncomeStatement, "creditoOtorgado" | "creditoCobrado"> {
  const { creditoOtorgado, creditoCobrado, ...rest } = statement;
  void creditoOtorgado;
  void creditoCobrado;
  return rest;
}

describe("assembleIncomeStatement — credit is informative, never arithmetic (F-037)", () => {
  it("P1: two inputs that differ ONLY in deductions.credito produce an IDENTICAL statement in every field except creditoOtorgado/creditoCobrado (criterion 5 — profit is accrued)", () => {
    const withoutCredit = assembleIncomeStatement(
      makeInput({ deductions: { totalGastos: 0, totalMerma: 0, totalDevoluciones: 0, credito: makeCredito({ otorgado: 0, cobrado: 0 }) } }),
    );
    const withCredit = assembleIncomeStatement(
      makeInput({ deductions: { totalGastos: 0, totalMerma: 0, totalDevoluciones: 0, credito: makeCredito({ otorgado: 1000, cobrado: 300 }) } }),
    );

    expect(withoutCreditFields(withCredit)).toEqual(
      withoutCreditFields(withoutCredit),
    );
    // And they DO differ where they're supposed to — otherwise P1 would be
    // vacuously true because nothing distinguishes the two inputs (E-008).
    expect(withCredit.creditoOtorgado).not.toBe(withoutCredit.creditoOtorgado);
    expect(withCredit.creditoCobrado).not.toBe(withoutCredit.creditoCobrado);
  });

  it("P2: creditoOtorgado and creditoCobrado are READ verbatim from deductions.credito, never derived from anything else in the statement (E-013)", () => {
    const statement = assembleIncomeStatement(
      makeInput({
        summary: makeSummary({ totalPeriodo: 999, gananciaTotal: 42 }),
        deductions: {
          totalGastos: 10,
          totalMerma: 5,
          totalDevoluciones: 1,
          credito: makeCredito({ otorgado: 1000, cobrado: 300 }),
        },
      }),
    );

    expect(statement.creditoOtorgado).toBe(1000);
    expect(statement.creditoCobrado).toBe(300);
  });

  it("P2, the negative case (ADR 0121): a reversed credit collection is a negative creditoCobrado, propagated with its sign — never Math.abs'd away", () => {
    const statement = assembleIncomeStatement(
      makeInput({
        deductions: {
          totalGastos: 0,
          totalMerma: 0,
          totalDevoluciones: 0,
          credito: makeCredito({ otorgado: 500, cobrado: -300 }),
        },
      }),
    );

    expect(statement.creditoCobrado).toBe(-300);
    expect(statement.creditoCobrado).not.toBe(300);
    expect(statement.creditoCobrado).not.toBe(Math.abs(-300));
  });

  it("P3: gananciaFinal === margenBruto - gastosOperativos - merma - devoluciones, with credito at ANY value, including negative cobrado (criterion 6's hand-sum)", () => {
    const summary = makeSummary({ gananciaTotal: 1200 });
    const deductions = {
      totalGastos: 100,
      totalMerma: 20,
      totalDevoluciones: 10,
      credito: makeCredito({ otorgado: 1000, cobrado: -300 }),
    };

    const statement = assembleIncomeStatement(
      makeInput({ summary, deductions }),
    );

    expect(statement.margenBruto).toBe(1200);
    expect(statement.gananciaFinal).toBe(
      statement.margenBruto -
        statement.gastosOperativos -
        statement.merma -
        statement.devoluciones,
    );
    expect(statement.gananciaFinal).toBe(1200 - 100 - 20 - 10);
  });

  it("Escenario C's own numbers (spec criterion 6): ventasNetas 2000, margenBruto 1200, no expenses/merma/devoluciones, gananciaFinal 1200 regardless of the credit lines", () => {
    const statement = assembleIncomeStatement(
      makeInput({
        summary: makeSummary({
          totalPeriodo: 2000,
          gananciaTotal: 1200,
          costoMercanciaVendida: 800,
        }),
        deductions: {
          totalGastos: 0,
          totalMerma: 0,
          totalDevoluciones: 0,
          credito: makeCredito({ otorgado: 1000, cobrado: 300 }),
        },
      }),
    );

    expect(statement.ventasNetas).toBe(2000);
    expect(statement.margenBruto).toBe(1200);
    expect(statement.gananciaFinal).toBe(1200);
    expect(statement.creditoOtorgado).toBe(1000);
    expect(statement.creditoCobrado).toBe(300);
    // Summing or subtracting the two informative lines from gananciaFinal is
    // NOT part of the cascade — proof that they sit outside it.
    expect(statement.gananciaFinal).not.toBe(
      1200 + statement.creditoOtorgado - statement.creditoCobrado,
    );
  });

  it("sorts gastosPorCategoria by amount descending, with at least two entries — a single-entry fixture would not exercise the comparator (E-008)", () => {
    const statement = assembleIncomeStatement(
      makeInput({
        gastosPorCategoria: [
          makeExpenseLine({ categoria: "renta", monto: 100 }),
          makeExpenseLine({ categoria: "salarios", monto: 500 }),
          makeExpenseLine({ categoria: "servicios", monto: 250 }),
        ],
      }),
    );

    expect(statement.gastosPorCategoria.map((l) => l.categoria)).toEqual([
      "salarios",
      "servicios",
      "renta",
    ]);
  });

  it("sorts inversionPorCategoria by amount descending, with at least two entries", () => {
    const statement = assembleIncomeStatement(
      makeInput({
        inversionPorCategoria: [
          makeExpenseLine({
            categoria: "equipo",
            naturaleza: "INVERSION",
            monto: 200,
          }),
          makeExpenseLine({
            categoria: "mobiliario",
            naturaleza: "INVERSION",
            monto: 900,
          }),
        ],
      }),
    );

    expect(statement.inversionPorCategoria.map((l) => l.categoria)).toEqual([
      "mobiliario",
      "equipo",
    ]);
  });

  it("ajusteConciliacion keeps its existing rule untouched by credit: gastosOperativos - breakdownOperativo, zeroed under the 0.01 tolerance", () => {
    const reconciled = assembleIncomeStatement(
      makeInput({
        deductions: {
          totalGastos: 100,
          totalMerma: 0,
          totalDevoluciones: 0,
          credito: makeCredito({ otorgado: 1000, cobrado: 300 }),
        },
        breakdownOperativo: 100,
      }),
    );
    const unreconciled = assembleIncomeStatement(
      makeInput({
        deductions: {
          totalGastos: 100,
          totalMerma: 0,
          totalDevoluciones: 0,
          credito: makeCredito({ otorgado: 1000, cobrado: 300 }),
        },
        breakdownOperativo: 60,
      }),
    );

    expect(reconciled.ajusteConciliacion).toBe(0);
    expect(unreconciled.ajusteConciliacion).toBe(40);
  });
});
