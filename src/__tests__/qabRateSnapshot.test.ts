import { describe, it, expect } from "vitest";
import {
  qabRateSnapshotSchema,
  parseQabRateSnapshot,
} from "@/schemas/qabRateSnapshot";

/**
 * F-011 — `src/schemas/qabRateSnapshot.ts` (contract § 2.1). `PedidoEntrante.rateSnapshot`
 * as QAB persists it, read from contract v10.1 § 3-4:
 *
 *   { "base": "CUP", "capturedAt": "2026-08-26T02:00:00.000Z", "rates": { "USD": "440.000000" } }
 *
 * Two properties are the whole point of this schema, and both are tested against
 * ACTUAL parse behaviour, not by reading the source:
 *
 * 1. NOT `.strict()` — a key QAB adds tomorrow must not make an already-stored order
 *    unreadable (contract § 2.1).
 * 2. `rates` values stay `unknown` — ONE unreadable rate must not cost the whole
 *    snapshot (validated per-currency by `readQabRate`, tested in qabRateConversion.test.ts).
 *
 * `parseQabRateSnapshot` is the ONLY thing F-011 uses to read this column, and it must
 * NEVER throw: its `safeParse` issues are neither returned nor logged (ADR 0061, E-031)
 * — criterion 13 depends on this function degrading to `null`, not raising.
 */

describe("qabRateSnapshotSchema", () => {
  it("should accept the exact shape published by contract v10.1 § 3-4", () => {
    const result = qabRateSnapshotSchema.safeParse({
      base: "CUP",
      capturedAt: "2026-08-26T02:00:00.000Z",
      rates: { USD: "440.000000" },
    });

    expect(result.success).toBe(true);
  });

  it("should default `rates` to {} when the key is absent", () => {
    const result = qabRateSnapshotSchema.safeParse({ base: "CUP" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rates).toEqual({});
    }
  });

  it("should accept capturedAt omitted or explicitly null (nullish, not required)", () => {
    expect(
      qabRateSnapshotSchema.safeParse({ base: "CUP", rates: {} }).success,
    ).toBe(true);
    expect(
      qabRateSnapshotSchema.safeParse({
        base: "CUP",
        capturedAt: null,
        rates: {},
      }).success,
    ).toBe(true);
  });

  it("should reject a missing or empty `base`", () => {
    expect(qabRateSnapshotSchema.safeParse({ rates: {} }).success).toBe(
      false,
    );
    expect(
      qabRateSnapshotSchema.safeParse({ base: "", rates: {} }).success,
    ).toBe(false);
  });

  it("should NOT be .strict(): an unknown top-level key does not fail the parse", () => {
    const result = qabRateSnapshotSchema.safeParse({
      base: "CUP",
      rates: {},
      aFieldQabAddsTomorrow: "whatever",
    });

    expect(result.success).toBe(true);
  });

  it("should keep a rate value as `unknown` — an object, a number, garbage all parse at this level", () => {
    const result = qabRateSnapshotSchema.safeParse({
      base: "CUP",
      rates: { USD: "440.000000", EUR: 480, XXX: { nested: true }, YYY: null },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rates.XXX).toEqual({ nested: true });
      expect(result.data.rates.YYY).toBeNull();
    }
  });
});

describe("parseQabRateSnapshot", () => {
  it("should return the parsed snapshot for a valid value", () => {
    const parsed = parseQabRateSnapshot({
      base: "CUP",
      capturedAt: "2026-08-26T02:00:00.000Z",
      rates: { USD: "440.000000" },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.base).toBe("CUP");
    expect(parsed?.rates).toEqual({ USD: "440.000000" });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a bare string", "not-json-shaped"],
    ["a number", 42],
    ["an array", ["CUP"]],
    ["an object missing base", { rates: {} }],
    ["an object with an empty base", { base: "", rates: {} }],
  ] as const)(
    "should return null, and never throw, for %s",
    (_label, value) => {
      expect(() => parseQabRateSnapshot(value)).not.toThrow();
      expect(parseQabRateSnapshot(value)).toBeNull();
    },
  );

  it("should not throw even for a deeply malformed rates map (ADR 0061: safeParse, never throw)", () => {
    expect(() =>
      parseQabRateSnapshot({
        base: "CUP",
        rates: { USD: { unexpected: ["shape"] } },
      }),
    ).not.toThrow();
  });
});
