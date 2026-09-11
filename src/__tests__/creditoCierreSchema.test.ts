import { describe, it, expect } from "vitest";

/**
 * F-036 — `src/schemas/cierre.ts` (contract § 2, testability § 9): the four new schemas
 * (`creditFlowSourceSchema`, `creditFlowSchema`, `creditColumnSumsSchema`,
 * `currencyCreditLinesSchema`) and the additive extensions of `cierrePeriodoSchema`,
 * `cierreDataSchema`, `cierreStoredTotalsSchema` and `summaryCierreSchema`.
 *
 * Written against the contract, without reading the implementation.
 *
 * `src/schemas/cierre.ts` already exists (pre-F-036) and many other test files import
 * from it. A single namespace import at module scope — never a static
 * `import { X } from "@/schemas/cierre"` for a symbol the contract adds — means a symbol
 * this feature hasn't landed yet reads as `undefined` inside the one test that needs it,
 * instead of throwing a collection-time SyntaxError that would tumble this whole file
 * (E-019, and its "any existing named import can be missing mid-parallel-work" corollary).
 */
const cierreSchemas = await import("@/schemas/cierre");

// zod 4 validates .uuid() against RFC 4122 (E-072): version and variant nibbles matter.
const UUID = "11111111-1111-4111-8111-111111111111";
const baseTienda = { id: UUID, nombre: "Tienda Test", negocioId: UUID, tipo: "TIENDA" };

/** Minimal valid `ICierrePeriodo` shape, without any of the three credit figures. */
const baseCierrePeriodo = {
  id: UUID,
  fechaInicio: new Date("2026-01-01T00:00:00.000Z"),
  tiendaId: UUID,
  tienda: baseTienda,
  totalVentas: 2000,
  totalGanancia: 500,
  totalInversion: 0,
  totalTransferencia: 700,
};

/** Minimal valid `ICierreData` shape, without any of the three credit figures. */
const baseCierreData = {
  productosVendidos: [],
  totalVentas: 2000,
  totalGanancia: 500,
  totalTransferencia: 700,
  totalVentasPorUsuario: [],
};

/** A `cierreStoredTotalsSchema`-shaped fixture with all nineteen required numbers. */
function fullStoredTotals(overrides: Record<string, unknown> = {}) {
  return {
    totalVentas: 2000,
    totalVentasBrutas: 2000,
    totalDescuentos: 0,
    totalInversion: 0,
    totalGanancia: 500,
    totalTransferencia: 700,
    totalVentasPropias: 2000,
    totalVentasConsignacion: 0,
    totalGananciasPropias: 500,
    totalGananciasConsignacion: 0,
    totalGastos: 0,
    totalGananciaFinal: 500,
    totalComprasCaja: 0,
    totalMerma: 0,
    totalDevoluciones: 0,
    totalTips: 0,
    totalCreditoOtorgado: 1000,
    totalCobrosCredito: 300,
    totalPorCobrarAlCierre: 700,
    ...overrides,
  };
}

/** Minimal valid `ISummaryCierre` shape, without the two credit sums. */
const baseSummary = {
  cierres: [],
  sumTotalGanancia: 500,
  sumTotalInversion: 0,
  sumTotalVentas: 2000,
  sumTotalTransferencia: 700,
  totalItems: 1,
};

describe("creditFlowSourceSchema — .pick() mirror of cierrePeriodoSchema, both optional", () => {
  it("accepts an object with neither figure present", () => {
    expect(cierreSchemas.creditFlowSourceSchema?.safeParse({}).success).toBe(true);
  });

  it("accepts the central scenario's two figures", () => {
    const result = cierreSchemas.creditFlowSourceSchema?.safeParse({
      totalCreditoOtorgado: 1000,
      totalCobrosCredito: 300,
    });
    expect(result?.success).toBe(true);
    expect(result?.data).toEqual({ totalCreditoOtorgado: 1000, totalCobrosCredito: 300 });
  });

  it("rejects a non-numeric totalCreditoOtorgado", () => {
    expect(
      cierreSchemas.creditFlowSourceSchema?.safeParse({ totalCreditoOtorgado: "1000" })
        .success,
    ).toBe(false);
  });
});

describe("creditFlowSchema — the normalized { granted, collected }, BOTH REQUIRED (unlike the source schema)", () => {
  it("accepts the central scenario", () => {
    const result = cierreSchemas.creditFlowSchema?.safeParse({ granted: 1000, collected: 300 });
    expect(result?.success).toBe(true);
    expect(result?.data).toEqual({ granted: 1000, collected: 300 });
  });

  it("accepts a negative 'collected' (ADR 0128 reversal)", () => {
    expect(
      cierreSchemas.creditFlowSchema?.safeParse({ granted: 0, collected: -300 }).success,
    ).toBe(true);
  });

  it("rejects an object missing 'granted' — required here, unlike creditFlowSourceSchema's optional source field", () => {
    expect(cierreSchemas.creditFlowSchema?.safeParse({ collected: 300 }).success).toBe(false);
  });

  it("rejects an object missing 'collected'", () => {
    expect(cierreSchemas.creditFlowSchema?.safeParse({ granted: 1000 }).success).toBe(false);
  });
});

describe("creditColumnSumsSchema — .pick() mirror of summaryCierreSchema's two sums, both optional", () => {
  it("accepts an object with neither sum present", () => {
    expect(cierreSchemas.creditColumnSumsSchema?.safeParse({}).success).toBe(true);
  });

  it("accepts both sums of the central scenario", () => {
    const result = cierreSchemas.creditColumnSumsSchema?.safeParse({
      sumTotalCreditoOtorgado: 1000,
      sumTotalCobrosCredito: 300,
    });
    expect(result?.success).toBe(true);
    expect(result?.data).toEqual({ sumTotalCreditoOtorgado: 1000, sumTotalCobrosCredito: 300 });
  });

  it("rejects a non-numeric sum", () => {
    expect(
      cierreSchemas.creditColumnSumsSchema?.safeParse({ sumTotalCreditoOtorgado: "x" }).success,
    ).toBe(false);
  });
});

describe("currencyCreditLinesSchema — { granted, collected } nullable but REQUIRED (not optional)", () => {
  it("accepts a row with 'collected' hidden (null)", () => {
    const result = cierreSchemas.currencyCreditLinesSchema?.safeParse({
      granted: 1000,
      collected: null,
    });
    expect(result?.success).toBe(true);
    expect(result?.data).toEqual({ granted: 1000, collected: null });
  });

  it("accepts a row with both lines hidden", () => {
    expect(
      cierreSchemas.currencyCreditLinesSchema?.safeParse({ granted: null, collected: null })
        .success,
    ).toBe(true);
  });

  it("rejects an object missing the 'granted' key entirely — nullable is not the same as optional", () => {
    expect(
      cierreSchemas.currencyCreditLinesSchema?.safeParse({ collected: null }).success,
    ).toBe(false);
  });

  it("rejects a string where a number-or-null is required", () => {
    expect(
      cierreSchemas.currencyCreditLinesSchema?.safeParse({ granted: "1000", collected: null })
        .success,
    ).toBe(false);
  });
});

describe("cierrePeriodoSchema — extended with the three credit figures, all optional", () => {
  it("accepts a period WITHOUT any of the three figures (older payload, F-032 § 0.2)", () => {
    expect(cierreSchemas.cierrePeriodoSchema.safeParse(baseCierrePeriodo).success).toBe(true);
  });

  it("accepts a period WITH the three figures and echoes them back unchanged", () => {
    const result = cierreSchemas.cierrePeriodoSchema.safeParse({
      ...baseCierrePeriodo,
      totalCreditoOtorgado: 1000,
      totalCobrosCredito: 300,
      totalPorCobrarAlCierre: 700,
    });
    expect(result.success).toBe(true);
    expect(result.data?.totalCreditoOtorgado).toBe(1000);
    expect(result.data?.totalCobrosCredito).toBe(300);
    expect(result.data?.totalPorCobrarAlCierre).toBe(700);
  });

  it("rejects a non-numeric totalCobrosCredito", () => {
    expect(
      cierreSchemas.cierrePeriodoSchema.safeParse({
        ...baseCierrePeriodo,
        totalCobrosCredito: "300",
      }).success,
    ).toBe(false);
  });
});

describe("cierreDataSchema — extended with the three credit figures, all optional", () => {
  it("accepts cierre data WITHOUT any of the three figures", () => {
    expect(cierreSchemas.cierreDataSchema.safeParse(baseCierreData).success).toBe(true);
  });

  it("accepts cierre data WITH the three figures and echoes them back unchanged", () => {
    const result = cierreSchemas.cierreDataSchema.safeParse({
      ...baseCierreData,
      totalCreditoOtorgado: 1000,
      totalCobrosCredito: 300,
      totalPorCobrarAlCierre: 700,
    });
    expect(result.success).toBe(true);
    expect(result.data?.totalCreditoOtorgado).toBe(1000);
    expect(result.data?.totalCobrosCredito).toBe(300);
    expect(result.data?.totalPorCobrarAlCierre).toBe(700);
  });
});

describe("cierreStoredTotalsSchema — now exported (contract § 2.3), the three credit figures REQUIRED, not optional", () => {
  it("accepts the full mirror of CierreStoredTotals with all nineteen figures present", () => {
    expect(cierreSchemas.cierreStoredTotalsSchema?.safeParse(fullStoredTotals()).success).toBe(
      true,
    );
  });

  it("rejects a payload missing totalCreditoOtorgado — the mirror would be broken (§ 2.3)", () => {
    const { totalCreditoOtorgado: _omit, ...withoutGranted } = fullStoredTotals();
    expect(cierreSchemas.cierreStoredTotalsSchema?.safeParse(withoutGranted).success).toBe(
      false,
    );
  });

  it("rejects a payload missing totalCobrosCredito", () => {
    const { totalCobrosCredito: _omit, ...withoutCollected } = fullStoredTotals();
    expect(cierreSchemas.cierreStoredTotalsSchema?.safeParse(withoutCollected).success).toBe(
      false,
    );
  });

  it("rejects a payload missing totalPorCobrarAlCierre", () => {
    const { totalPorCobrarAlCierre: _omit, ...withoutStock } = fullStoredTotals();
    expect(cierreSchemas.cierreStoredTotalsSchema?.safeParse(withoutStock).success).toBe(false);
  });
});

describe("summaryCierreSchema — extended with the two FLOW sums; the STOCK gains no sum (§ 2.4, ADR 0130)", () => {
  it("accepts a summary WITHOUT the two sums (optional, older payload)", () => {
    expect(cierreSchemas.summaryCierreSchema.safeParse(baseSummary).success).toBe(true);
  });

  it("accepts a summary WITH the two sums and echoes them back unchanged", () => {
    const result = cierreSchemas.summaryCierreSchema.safeParse({
      ...baseSummary,
      sumTotalCreditoOtorgado: 1000,
      sumTotalCobrosCredito: 300,
    });
    expect(result.success).toBe(true);
    expect(result.data?.sumTotalCreditoOtorgado).toBe(1000);
    expect(result.data?.sumTotalCobrosCredito).toBe(300);
  });

  it("declares sumTotalCreditoOtorgado and sumTotalCobrosCredito in its shape", () => {
    const keys = Object.keys(cierreSchemas.summaryCierreSchema.shape);
    expect(keys).toContain("sumTotalCreditoOtorgado");
    expect(keys).toContain("sumTotalCobrosCredito");
  });

  it("does NOT declare a summed stock field — totalPorCobrarAlCierre is never summed across periods", () => {
    const keys = Object.keys(cierreSchemas.summaryCierreSchema.shape);
    expect(keys).not.toContain("sumTotalPorCobrarAlCierre");
  });

  it("each row of 'cierres' carries the three credit figures typed (they ride cierrePeriodoSchema)", () => {
    const result = cierreSchemas.summaryCierreSchema.safeParse({
      ...baseSummary,
      cierres: [
        {
          id: UUID,
          fechaInicio: new Date("2026-01-01T00:00:00.000Z"),
          tiendaId: UUID,
          totalVentas: 2000,
          totalGanancia: 500,
          totalInversion: 0,
          totalTransferencia: 700,
          totalCreditoOtorgado: 1000,
          totalCobrosCredito: 300,
          totalPorCobrarAlCierre: 700,
        },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.data?.cierres[0]?.totalCreditoOtorgado).toBe(1000);
  });
});
