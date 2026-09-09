import { describe, expect, it } from "vitest";
import {
  salesCutoffTargetSchema,
  setSalesCutoffSchema,
  closeCierreSchema,
  salesCutoffStateSchema,
  closeCierreResultSchema,
  cierrePeriodoSchema,
  cierreDataSchema,
} from "@/schemas/cierre";

/**
 * F-029 — contract § 3, § 12. Every type of this feature is `z.infer<>` from
 * these schemas; no interface is written by hand.
 */

const validPeriodRow = (over: Record<string, unknown> = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  fechaInicio: "2026-09-06T09:00:00.000Z",
  tiendaId: "22222222-2222-4222-8222-222222222222",
  totalVentas: 100,
  totalGanancia: 40,
  totalInversion: 60,
  totalTransferencia: 0,
  ...over,
});

describe("salesCutoffTargetSchema", () => {
  it('accepts mode "at" with a coercible cutoffAt', () => {
    const parsed = salesCutoffTargetSchema.parse({
      mode: "at",
      cutoffAt: "2026-09-08T12:00:00.000Z",
    });
    expect(parsed).toEqual({
      mode: "at",
      cutoffAt: new Date("2026-09-08T12:00:00.000Z"),
    });
  });

  it('rejects mode "at" without a cutoffAt', () => {
    expect(salesCutoffTargetSchema.safeParse({ mode: "at" }).success).toBe(
      false,
    );
  });

  it('accepts mode "now" with no other field', () => {
    expect(salesCutoffTargetSchema.safeParse({ mode: "now" }).success).toBe(
      true,
    );
  });

  it('accepts mode "clear" with no other field', () => {
    expect(salesCutoffTargetSchema.safeParse({ mode: "clear" }).success).toBe(
      true,
    );
  });

  it('rejects a mode outside the three documented ones (e.g. the derogated "everything")', () => {
    expect(
      salesCutoffTargetSchema.safeParse({ mode: "everything" }).success,
    ).toBe(false);
  });
});

describe("setSalesCutoffSchema — body of PATCH .../sales-cutoff", () => {
  it("accepts a target plus a null expectedCutoffAt (no cut believed in force)", () => {
    const parsed = setSalesCutoffSchema.parse({
      target: { mode: "clear" },
      expectedCutoffAt: null,
    });
    expect(parsed.expectedCutoffAt).toBeNull();
  });

  it("accepts a target plus a coercible expectedCutoffAt", () => {
    const parsed = setSalesCutoffSchema.parse({
      target: { mode: "now" },
      expectedCutoffAt: "2026-09-08T12:00:00.000Z",
    });
    expect(parsed.expectedCutoffAt).toEqual(
      new Date("2026-09-08T12:00:00.000Z"),
    );
  });

  it("rejects a body that OMITS expectedCutoffAt — nullable is not optional, the key is mandatory", () => {
    expect(
      setSalesCutoffSchema.safeParse({ target: { mode: "clear" } }).success,
    ).toBe(false);
  });

  it("rejects a body missing target", () => {
    expect(
      setSalesCutoffSchema.safeParse({ expectedCutoffAt: null }).success,
    ).toBe(false);
  });
});

describe("closeCierreSchema — body of PUT .../close", () => {
  it("accepts a null expectedCutoffAt — no cut believed in force", () => {
    expect(closeCierreSchema.parse({ expectedCutoffAt: null })).toEqual({
      expectedCutoffAt: null,
    });
  });

  it("accepts a coercible expectedCutoffAt", () => {
    const parsed = closeCierreSchema.parse({
      expectedCutoffAt: "2026-09-08T12:00:00.000Z",
    });
    expect(parsed.expectedCutoffAt).toEqual(
      new Date("2026-09-08T12:00:00.000Z"),
    );
  });

  it('rejects a body that OMITS expectedCutoffAt — the body became MANDATORY in F-029 (contract § 7.1), an absent key must not silently mean "no cut expected"', () => {
    expect(closeCierreSchema.safeParse({}).success).toBe(false);
  });
});

describe("salesCutoffStateSchema", () => {
  // `includedCount` is a SENT count, not something the banner infers from two
  // empty arrays (an included sale with no product lines and no user would
  // fool that inference) — added after the contract closed, when the
  // implementer needed it to know whether a close would take no sale at all.
  const base = {
    cutoffAt: null,
    includedCount: 0,
    deferredCount: 0,
    deferredTotal: 0,
  };

  it("accepts the no-cut state", () => {
    expect(salesCutoffStateSchema.parse(base)).toEqual(base);
  });

  it("rejects a negative deferredCount", () => {
    expect(
      salesCutoffStateSchema.safeParse({ ...base, deferredCount: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer deferredCount", () => {
    expect(
      salesCutoffStateSchema.safeParse({ ...base, deferredCount: 1.5 }).success,
    ).toBe(false);
  });

  it("rejects a negative includedCount", () => {
    expect(
      salesCutoffStateSchema.safeParse({ ...base, includedCount: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer includedCount", () => {
    expect(
      salesCutoffStateSchema.safeParse({ ...base, includedCount: 2.5 }).success,
    ).toBe(false);
  });

  it("rejects a body that OMITS includedCount — it is required, not optional", () => {
    const { includedCount: _includedCount, ...withoutIncludedCount } = base;
    expect(salesCutoffStateSchema.safeParse(withoutIncludedCount).success).toBe(
      false,
    );
  });

  it("accepts a real cutoff with its included/deferred figures, coercing cutoffAt", () => {
    const parsed = salesCutoffStateSchema.parse({
      cutoffAt: "2026-09-08T12:00:00.000Z",
      includedCount: 3,
      deferredCount: 2,
      deferredTotal: 150.5,
    });
    expect(parsed.cutoffAt).toEqual(new Date("2026-09-08T12:00:00.000Z"));
    expect(parsed.includedCount).toBe(3);
  });

  it("a close with a cutoff CAN still take zero sales — includedCount 0 with deferredCount > 0 is a valid state, not an error", () => {
    // The exact case includedCount exists for: the operator drags the cutoff
    // to "Nada" and every sale of the period defers.
    expect(
      salesCutoffStateSchema.safeParse({
        cutoffAt: "2026-09-08T09:00:00.001Z",
        includedCount: 0,
        deferredCount: 5,
        deferredTotal: 300,
      }).success,
    ).toBe(true);
  });
});

describe("closeCierreResultSchema — response of PUT .../close", () => {
  it("accepts a close with NO cutoff: openedPeriod null, deferred figures zero", () => {
    const parsed = closeCierreResultSchema.parse({
      closedPeriod: validPeriodRow(),
      openedPeriod: null,
      deferredCount: 0,
      deferredTotal: 0,
    });
    expect(parsed.openedPeriod).toBeNull();
  });

  it("accepts a close WITH a cutoff: both the closed and the opened period are present", () => {
    const opened = validPeriodRow({
      id: "33333333-3333-4333-8333-333333333333",
    });
    const parsed = closeCierreResultSchema.parse({
      closedPeriod: validPeriodRow(),
      openedPeriod: opened,
      deferredCount: 3,
      deferredTotal: 220,
    });
    expect(parsed.openedPeriod?.id).toBe(opened.id);
  });

  it("rejects a negative deferredCount", () => {
    expect(
      closeCierreResultSchema.safeParse({
        closedPeriod: validPeriodRow(),
        openedPeriod: null,
        deferredCount: -1,
        deferredTotal: 0,
      }).success,
    ).toBe(false);
  });
});

describe("cierrePeriodoSchema — salesCutoffAt, added by F-029", () => {
  const rowSchema = cierrePeriodoSchema.omit({ tienda: true });

  it("accepts a row with salesCutoffAt as a coercible date", () => {
    const parsed = rowSchema.parse({
      ...validPeriodRow(),
      salesCutoffAt: "2026-09-08T12:00:00.000Z",
    });
    expect(parsed.salesCutoffAt).toEqual(new Date("2026-09-08T12:00:00.000Z"));
  });

  it("accepts salesCutoffAt explicitly null (no cut) and accepts it being absent altogether — both mean the same thing", () => {
    expect(
      rowSchema.parse({ ...validPeriodRow(), salesCutoffAt: null })
        .salesCutoffAt,
    ).toBeNull();
    expect(rowSchema.parse(validPeriodRow()).salesCutoffAt).toBeUndefined();
  });
});

describe("cierreDataSchema — salesCutoff block, added by F-029", () => {
  const validData = () => ({
    productosVendidos: [],
    totalVentas: 100,
    totalGanancia: 40,
    totalTransferencia: 0,
    totalVentasPorUsuario: [],
  });

  it("accepts the block GET /api/cierre/[tiendaId]/[cierreId] always emits (contract § 5.2)", () => {
    const parsed = cierreDataSchema.parse({
      ...validData(),
      salesCutoff: {
        cutoffAt: null,
        includedCount: 4,
        deferredCount: 0,
        deferredTotal: 0,
      },
    });
    expect(parsed.salesCutoff).toEqual({
      cutoffAt: null,
      includedCount: 4,
      deferredCount: 0,
      deferredTotal: 0,
    });
  });

  it("stays valid WITHOUT salesCutoff — optional, for the historical view's own ICierreData (contract § 3)", () => {
    expect(cierreDataSchema.safeParse(validData()).success).toBe(true);
  });
});
