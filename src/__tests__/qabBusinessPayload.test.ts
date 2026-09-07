import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  buildQabDisplayCurrencies,
  buildQabBusinessPayload,
} from "@/lib/qab/qabBusinessPayload";
import {
  qabBusinessPayloadSchema,
  qabDisplayCurrenciesInputSchema,
} from "@/schemas/qabBusiness";
import type {
  IQabDisplayCurrenciesInput,
  IQabBusinessPayloadInput,
} from "@/schemas/qabBusiness";

/**
 * F-027 — `buildQabDisplayCurrencies` / `buildQabBusinessPayload`
 * (`src/lib/qab/qabBusinessPayload.ts`, contract § 3), and their input/output
 * schemas (`src/schemas/qabBusiness.ts`, contract § 2).
 *
 * This is § 10.1 of the contract's testability list: pure, no database, no
 * network. Criteria 1, 3, 5, 7, 8 and 9 need a database and belong to `qa`, not
 * here (contract § 10.2) — nothing in this file fabricates a Prisma mock to
 * simulate them.
 *
 * If any import below fails to resolve, it means `implementer` has not created
 * that file/export yet: expected and reported, never patched from this side
 * (see this feature's dev-tester report).
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const OCCURRED_AT = new Date("2026-09-04T10:00:00.000Z");

function displayCurrenciesInput(
  overrides: Partial<IQabDisplayCurrenciesInput> = {}
): IQabDisplayCurrenciesInput {
  return {
    monedas: [],
    monedaBase: "CUP",
    ...overrides,
  };
}

function businessPayloadInput(
  overrides: Partial<IQabBusinessPayloadInput> = {}
): IQabBusinessPayloadInput {
  return {
    negocioId: NEGOCIO_ID,
    monedas: [],
    monedaBase: "CUP",
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

describe("buildQabDisplayCurrencies — active rows + base, filtered by SHAPE only, never by rate", () => {
  it("should combine active rows with the base currency, sorted and without duplicates, when the base ALSO has its own active row", () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          // The base has its OWN active NegocioMoneda row too: it must not appear twice.
          { monedaCode: "CUP", activo: true },
        ],
        monedaBase: "CUP",
      })
    );

    expect(result).toEqual(["CUP", "USD"]);
  });

  it("criterion 2: a DEACTIVATED row does NOT appear in the list", () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          { monedaCode: "EUR", activo: false },
        ],
        monedaBase: "CUP",
      })
    );

    expect(result).toEqual(["CUP", "USD"]);
    expect(result).not.toContain("EUR");
  });

  it("criterion 4 (first half): a malformed BASE currency is dropped and the REST of the list still travels", () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [{ monedaCode: "USD", activo: true }],
        monedaBase: "XX", // 2 characters: not the shape of a wire code
      })
    );

    expect(result).toEqual(["USD"]);
  });

  it("a malformed ACTIVE code is dropped and the rest of the list still travels", () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          { monedaCode: "TOOLONG", activo: true },
        ],
        monedaBase: "CUP",
      })
    );

    expect(result).toEqual(["CUP", "USD"]);
  });

  it('with no NegocioMoneda rows at all, returns ["CUP"] (the well-formed base alone), never []', () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({ monedas: [], monedaBase: "CUP" })
    );

    expect(result).toEqual(["CUP"]);
  });

  it("criterion 4 (second half, degenerate case): a malformed base AND no well-formed active row => [] — dishonest to fabricate a ['CUP'] nobody asked for", () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [{ monedaCode: "YY", activo: true }], // malformed active code
        monedaBase: "ZZ", // malformed base
      })
    );

    expect(result).toEqual([]);
  });

  it("sort is deterministic: two permutations of the same active set produce the identical array", () => {
    const a = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          { monedaCode: "EUR", activo: true },
        ],
        monedaBase: "CUP",
      })
    );
    const b = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "EUR", activo: true },
          { monedaCode: "USD", activo: true },
        ],
        monedaBase: "CUP",
      })
    );

    expect(a).toEqual(b);
    expect(a).toEqual(["CUP", "EUR", "USD"]);
  });

  it('sort uses the DEFAULT string comparison, never localeCompare — discriminated with "USD"/"usd", a pair that differs ONLY in case: `qabCurrencyCodeSchema` checks length alone, with no charset restriction, so "usd" is just as well-formed a code as "USD", and this pair is NOT hypothetical. Verified in Node before pinning it: ["CUP","USD","usd"].sort() -> ["CUP","USD","usd"], but the same array sorted with localeCompare -> ["CUP","usd","USD"] — the two methods genuinely disagree on this input, regardless of input order. If someone "cleans up" this test back to all-uppercase fixtures, a regression to localeCompare would stop failing anything.', () => {
    const result = buildQabDisplayCurrencies(
      displayCurrenciesInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          { monedaCode: "usd", activo: true },
        ],
        monedaBase: "CUP",
      })
    );

    expect(result).toEqual(["CUP", "USD", "usd"]);
    // Spelled out so a future reader sees the disagreement without re-deriving it in Node.
    expect(result).not.toEqual(["CUP", "usd", "USD"]);
  });

  // NOT covered here, on purpose: "a deactivated row that carries a registered
  // exchange rate does not appear" is NOT testable as a separate case from
  // criterion 2 above, because `IQabDisplayCurrenciesInput.monedas` rows
  // (`qabNegocioMonedaRowSchema`) declare NO rate field at all — see the
  // `qabDisplayCurrenciesInputSchema` describe block below, which asserts that
  // shape directly. That absence IS the guarantee (ADR 0092 § 3): the test that
  // would prune by "has no rate" cannot even be written, which is stronger than
  // a green case.
});

describe("buildQabBusinessPayload — updatedAt is occurredAt, verbatim; never a recomputed instant", () => {
  it("should set updatedAt to occurredAt.toISOString() — checked against the instant PASSED IN, not against the ISO shape: an implementation that recomputes `new Date().toISOString()` internally would fail this because OCCURRED_AT is not 'now'", () => {
    const payload = buildQabBusinessPayload(businessPayloadInput({ occurredAt: OCCURRED_AT }));

    expect(payload.updatedAt).toBe(OCCURRED_AT.toISOString());
    expect(payload.updatedAt).not.toBe(new Date().toISOString());
  });

  it("should preserve millisecond precision of occurredAt in updatedAt", () => {
    const occurredAt = new Date("2026-09-04T10:00:00.789Z");
    const payload = buildQabBusinessPayload(businessPayloadInput({ occurredAt }));

    expect(payload.updatedAt).toBe("2026-09-04T10:00:00.789Z");
  });

  it("should set businessId to negocioId, read from the same parameter", () => {
    const payload = buildQabBusinessPayload(businessPayloadInput({ negocioId: NEGOCIO_ID }));

    expect(payload.businessId).toBe(NEGOCIO_ID);
  });

  it("displayCurrencies should be buildQabDisplayCurrencies's own filtered/sorted/deduplicated result, not a raw pass-through of monedas — asserted against a literal, not by re-calling the same builder", () => {
    const payload = buildQabBusinessPayload(
      businessPayloadInput({
        monedas: [
          { monedaCode: "USD", activo: true },
          { monedaCode: "XX", activo: true }, // malformed: must be dropped
          { monedaCode: "EUR", activo: false }, // inactive: must not appear
        ],
        monedaBase: "CUP",
      })
    );

    expect(payload.displayCurrencies).toEqual(["CUP", "USD"]);
  });

  it("passes through the degenerate empty list into a valid payload — does not special-case []", () => {
    const payload = buildQabBusinessPayload(
      businessPayloadInput({
        monedas: [{ monedaCode: "YY", activo: true }],
        monedaBase: "ZZ",
      })
    );

    expect(payload.displayCurrencies).toEqual([]);
    expect(qabBusinessPayloadSchema.safeParse(payload).success).toBe(true);
  });

  it("should throw ZodError when negocioId is not a uuid", () => {
    expect(() =>
      buildQabBusinessPayload(businessPayloadInput({ negocioId: "not-a-uuid" }))
    ).toThrow(ZodError);
  });

  it("should throw RangeError, not ZodError, when occurredAt is an Invalid Date — toISOString() throws before the schema ever sees the value", () => {
    const invalidDate = new Date("not-a-real-date");

    expect(() => buildQabBusinessPayload(businessPayloadInput({ occurredAt: invalidDate }))).toThrow(
      RangeError
    );
  });

  it("should produce a payload that itself satisfies qabBusinessPayloadSchema", () => {
    const payload = buildQabBusinessPayload(businessPayloadInput());

    expect(qabBusinessPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("qabBusinessPayloadSchema", () => {
  const validPayload = {
    businessId: NEGOCIO_ID,
    displayCurrencies: ["CUP"],
    updatedAt: OCCURRED_AT.toISOString(),
  };

  it("should accept a well-formed payload", () => {
    expect(qabBusinessPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("should reject an extra key (.strict())", () => {
    expect(
      qabBusinessPayloadSchema.safeParse({ ...validPayload, extra: "x" }).success
    ).toBe(false);
  });

  it("should reject a 2-character currency code inside displayCurrencies", () => {
    expect(
      qabBusinessPayloadSchema.safeParse({ ...validPayload, displayCurrencies: ["CU"] }).success
    ).toBe(false);
  });

  it("should ACCEPT an empty displayCurrencies array — the contract declares [] valid ('only the base currency'), even though cuadrecaja's own builder never sends it except in the degenerate case", () => {
    expect(
      qabBusinessPayloadSchema.safeParse({ ...validPayload, displayCurrencies: [] }).success
    ).toBe(true);
  });
});

describe("qabDisplayCurrenciesInputSchema", () => {
  const validInput = {
    monedas: [{ monedaCode: "USD", activo: true }],
    monedaBase: "CUP",
  };

  it("should accept a well-formed input", () => {
    expect(qabDisplayCurrenciesInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("should reject an extra top-level key (.strict())", () => {
    expect(
      qabDisplayCurrenciesInputSchema.safeParse({ ...validInput, extra: 1 }).success
    ).toBe(false);
  });

  it("declares NO rate field on a NegocioMoneda row — this IS the structural guarantee that the list is never pruned for lack of a rate (criterion 4/ADR 0092 § 3): a `tasa` key on a row is not rejected, it is silently stripped, because the row schema has no such field at all", () => {
    const parsed = qabDisplayCurrenciesInputSchema.parse({
      monedas: [{ monedaCode: "USD", activo: true, tasa: 999 }],
      monedaBase: "CUP",
    });

    expect(parsed.monedas[0]).toEqual({ monedaCode: "USD", activo: true });
    expect(parsed.monedas[0]).not.toHaveProperty("tasa");
  });
});
