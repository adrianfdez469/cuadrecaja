import { describe, it, expect } from "vitest";

/**
 * F-032, contract § 3.2, § 3.3 — criterion 12 and the H1 character-bound amendment.
 *
 * `pagosDetalleConCreditoAppSchema`, `creditoExtrasSchema` and
 * `EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE` are NEW exports of `src/schemas/pago.ts` (an
 * edit to a closed F-029 file, ADR 0111). `multimonedaExtrasSchema.clienteNombre` is a
 * field ADDED to an existing schema. Dynamic top-level `await import` throughout this
 * file: none of these names exist until the `implementer` adds them (E-019) — a static
 * import of a name that is not yet exported would behave unpredictably depending on the
 * bundler's interop instead of failing cleanly at collection.
 */
const {
  pagosDetalleConCreditoAppSchema,
  pagosDetalleAppSchema,
  creditoExtrasSchema,
  multimonedaExtrasSchema,
  EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE,
} = await import("@/schemas/pago");

const CASH_LINE = {
  tipo: "cash" as const,
  moneda: "CUP",
  monto: 700,
  equivalenteBase: 700,
};

const TRANSFER_NO_DESTINATION = {
  tipo: "transfer" as const,
  moneda: "CUP",
  monto: 500,
  equivalenteBase: 500,
};

// The concrete "cash drawer kick" sequence from the dossier's own finding.
const KICK_SEQUENCE = "Ana\x1Bp\x00\x19\xFA";

describe("pagosDetalleConCreditoAppSchema — criterion 12, the full behaviour table (§ 3.2)", () => {
  it("{ pagosDetalle: [], creditoBase: 1000 } -> success (a 100% credit sale with no payment lines is valid)", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [],
      creditoBase: 1000,
    });
    expect(result.success).toBe(true);
  });

  it("{ pagosDetalle: [] } (creditoBase absent) -> rejected at path [\"pagosDetalle\"] — exactly today's rejection for an ordinary cash sale with no lines", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["pagosDetalle"]);
      expect(result.error.issues[0].message).toBe(
        EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE,
      );
    }
  });

  it("{ pagosDetalle: [], creditoBase: 0 } -> rejected — a zero credit does not count as credit", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [],
      creditoBase: 0,
    });
    expect(result.success).toBe(false);
  });

  it("{ pagosDetalle: [oneValidCashLine] } -> success, with no credit at all", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [CASH_LINE],
    });
    expect(result.success).toBe(true);
  });

  it("{ pagosDetalle: [transferSinDestino] } -> rejected at [\"pagosDetalle\", 0, \"transferDestinationId\"] — the SAME line-level rule pagosDetalleAppSchema already enforces", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [TRANSFER_NO_DESTINATION],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual([
        "pagosDetalle",
        0,
        "transferDestinationId",
      ]);
    }
  });

  it("lines AND credit together are accepted (a partial-credit sale)", () => {
    const result = pagosDetalleConCreditoAppSchema.safeParse({
      pagosDetalle: [CASH_LINE],
      creditoBase: 300,
    });
    expect(result.success).toBe(true);
  });
});

describe("pagosDetalleAppSchema — no-regression (§ 3.1: it keeps its .min(1) and stays a consumer-less but correct symbol)", () => {
  it("still rejects an empty array", () => {
    expect(pagosDetalleAppSchema.safeParse([]).success).toBe(false);
  });

  it("still accepts a single valid cash line", () => {
    expect(pagosDetalleAppSchema.safeParse([CASH_LINE]).success).toBe(true);
  });

  it("still enforces transferDestinationId on a transfer line with an amount", () => {
    expect(
      pagosDetalleAppSchema.safeParse([TRANSFER_NO_DESTINATION]).success,
    ).toBe(false);
  });
});

describe("creditoExtrasSchema — picked from multimonedaExtrasSchema, not restated", () => {
  it("accepts creditoBase, clienteId and clienteNombre together", () => {
    const result = creditoExtrasSchema.safeParse({
      creditoBase: 300,
      // crypto.randomUUID(): zod 4's uuid() enforces the RFC 4122 version/variant
      // nibbles, which an all-repeated-digit placeholder does not satisfy.
      clienteId: crypto.randomUUID(),
      clienteNombre: "Ana Pérez",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object — every field is optional", () => {
    expect(creditoExtrasSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a negative creditoBase (closes the hole checkCreditInvariant's own docstring warns about — it does not normalize negatives)", () => {
    expect(creditoExtrasSchema.safeParse({ creditoBase: -50 }).success).toBe(
      false,
    );
  });

  it("rejects a clienteId that is not a uuid", () => {
    expect(
      creditoExtrasSchema.safeParse({ creditoBase: 10, clienteId: "not-a-uuid" })
        .success,
    ).toBe(false);
  });
});

describe("multimonedaExtrasSchema.clienteNombre — H1, the character-set bound (ADR 0113)", () => {
  const validExtras = () => ({
    monedaCobro: "CUP",
    pagosDetalle: [],
    vueltoDetalle: [],
    tasaSnapshot: {},
  });

  it("accepts a clean, accented name up to 200 characters", () => {
    const result = multimonedaExtrasSchema.safeParse({
      ...validExtras(),
      clienteNombre: "Roberto Pérez",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a name carrying the concrete kick sequence, with the FIXED message and no fragment of the attack string (E-031)", () => {
    const result = multimonedaExtrasSchema.safeParse({
      ...validExtras(),
      clienteNombre: KICK_SEQUENCE,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("clienteNombre"),
      );
      expect(issue).toBeDefined();
      expect(issue?.message).not.toContain("\x1B");
    }
  });

  it("rejects a name of 201 characters (the length bound)", () => {
    const tooLong = "a".repeat(201);
    const result = multimonedaExtrasSchema.safeParse({
      ...validExtras(),
      clienteNombre: tooLong,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a name of exactly 200 characters", () => {
    const exactly200 = "a".repeat(200);
    const result = multimonedaExtrasSchema.safeParse({
      ...validExtras(),
      clienteNombre: exactly200,
    });
    expect(result.success).toBe(true);
  });

  it("is optional — absent clienteNombre is fine (an ordinary sale, or a credit sale identified only by clienteId)", () => {
    const result = multimonedaExtrasSchema.safeParse(validExtras());
    expect(result.success).toBe(true);
  });
});
