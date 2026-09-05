import { describe, it, expect } from "vitest";
import {
  buildQabCurrencyPayload,
  buildQabExchangeRatePayload,
  QabCurrencyPayloadError,
} from "@/lib/qab/qabCurrencyPayload";
import { qabCurrencyPayloadSchema, qabExchangeRatePayloadSchema } from "@/schemas/qabCurrency";
import type {
  IQabCurrencyPayloadInput,
  IQabExchangeRatePayloadInput,
} from "@/schemas/qabCurrency";
import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";

/**
 * F-006 — `buildQabCurrencyPayload` / `buildQabExchangeRatePayload`
 * (`src/lib/qab/qabCurrencyPayload.ts`, contract §4.3). Covers criteria 12, 14
 * and 15 at the unit level.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const OCCURRED_AT = new Date("2026-09-04T10:00:00.000Z");

function currencyInput(
  overrides: Partial<IQabCurrencyPayloadInput> = {}
): IQabCurrencyPayloadInput {
  return {
    code: "USD",
    nombre: "US Dollar",
    simbolo: "$",
    activo: true,
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

function rateInput(
  overrides: Partial<IQabExchangeRatePayloadInput> = {}
): IQabExchangeRatePayloadInput {
  return {
    negocioId: NEGOCIO_ID,
    monedaCode: "USD",
    tasa: 420.1234567,
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

describe("buildQabCurrencyPayload — criterion 12: no businessId, international name/symbol", () => {
  it("should build a payload with no businessId key at all", () => {
    const payload = buildQabCurrencyPayload(currencyInput());
    expect(payload).not.toHaveProperty("businessId");
  });

  it("should map nombre/simbolo/activo to name/symbol/active literally — Moneda's international text, never a merchant's own", () => {
    const payload = buildQabCurrencyPayload(
      currencyInput({ nombre: "Peso Cubano", simbolo: "$", activo: true })
    );
    expect(payload.name).toBe("Peso Cubano");
    expect(payload.symbol).toBe("$");
    expect(payload.active).toBe(true);
  });

  it("criterion 15: should accept activo: false — retiring a currency is this, never a DELETE", () => {
    const payload = buildQabCurrencyPayload(currencyInput({ activo: false }));
    expect(payload.active).toBe(false);
  });

  it("should throw QabCurrencyPayloadError with code currencyCodeInvalid for a malformed code", () => {
    try {
      buildQabCurrencyPayload(currencyInput({ code: "US" }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabCurrencyPayloadError);
      expect((error as QabCurrencyPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid
      );
    }
  });

  it("should serialise updatedAt as occurredAt.toISOString()", () => {
    const payload = buildQabCurrencyPayload(
      currencyInput({ occurredAt: new Date("2026-09-04T10:00:00.789Z") })
    );
    expect(payload.updatedAt).toBe("2026-09-04T10:00:00.789Z");
  });

  it("should produce a payload that itself satisfies qabCurrencyPayloadSchema (.strict(), no businessId)", () => {
    const payload = buildQabCurrencyPayload(currencyInput());
    expect(qabCurrencyPayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("buildQabExchangeRatePayload — criterion 14: six decimals, strictly positive, CUP never travels", () => {
  it("should round rate to 6 decimals via toQabExchangeRate", () => {
    const payload = buildQabExchangeRatePayload(rateInput({ tasa: 420.1234567 }));
    expect(payload.rate).toBe(420.123457);
  });

  it("should never round to the 2-decimal price scale", () => {
    const payload = buildQabExchangeRatePayload(rateInput({ tasa: 420.1234567 }));
    expect(payload.rate).not.toBe(420.12);
  });

  it("should include businessId, unlike CURRENCY", () => {
    const payload = buildQabExchangeRatePayload(rateInput());
    expect(payload.businessId).toBe(NEGOCIO_ID);
  });

  it("should throw QabCurrencyPayloadError with code currencyCodeInvalid for CUP — the anchor never travels as a rate", () => {
    try {
      buildQabExchangeRatePayload(rateInput({ monedaCode: "CUP" }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabCurrencyPayloadError);
      expect((error as QabCurrencyPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid
      );
    }
  });

  it("should throw QabCurrencyPayloadError with code currencyCodeInvalid for a malformed code", () => {
    expect(() => buildQabExchangeRatePayload(rateInput({ monedaCode: "US" }))).toThrow(
      QabCurrencyPayloadError
    );
  });

  it("should throw QabCurrencyPayloadError with code exchangeRateTooSmall when the ROUNDED rate is not strictly greater than zero", () => {
    try {
      buildQabExchangeRatePayload(rateInput({ tasa: 0.0000001 }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabCurrencyPayloadError);
      expect((error as QabCurrencyPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall
      );
    }
  });

  it("discriminating case: 4e-7 rounds to 0 at 6 decimals and throws exchangeRateTooSmall", () => {
    // Verified with `node -e "(4e-7).toFixed(6)"` -> "0.000000" before pinning this literal
    // (E-... toFixed boundary lesson): a paper guess about IEEE-754 rounding is not reliable.
    try {
      buildQabExchangeRatePayload(rateInput({ tasa: 4e-7 }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabCurrencyPayloadError);
      expect((error as QabCurrencyPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall
      );
    }
  });

  it("discriminating case: 6e-7 rounds UP to a valid, strictly-positive 0.000001 and is accepted", () => {
    // Verified with `node -e "(6e-7).toFixed(6)"` -> "0.000001". NOTE: 5e-7 (half of the smallest
    // representable unit) is NOT the right boundary to use here — verified in node that
    // (5e-7).toFixed(6) is ALSO "0.000000" (V8 rounds it down, not up, the same non-obvious
    // IEEE-754 double-representation quirk as toQabExchangeRate's own 0.0000005 case), so it
    // throws exchangeRateTooSmall exactly like 4e-7 rather than the "valid, 0.000001" case one
    // might expect from that literal.
    const payload = buildQabExchangeRatePayload(rateInput({ tasa: 6e-7 }));
    expect(payload.rate).toBe(0.000001);
  });

  it("should reject a zero or negative tasa the same way", () => {
    expect(() => buildQabExchangeRatePayload(rateInput({ tasa: 0 }))).toThrow(
      QabCurrencyPayloadError
    );
    expect(() => buildQabExchangeRatePayload(rateInput({ tasa: -5 }))).toThrow(
      QabCurrencyPayloadError
    );
  });

  it("should produce a payload that itself satisfies qabExchangeRatePayloadSchema", () => {
    const payload = buildQabExchangeRatePayload(rateInput());
    expect(qabExchangeRatePayloadSchema.safeParse(payload).success).toBe(true);
  });
});
