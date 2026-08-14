import { describe, it, expect } from "vitest";
import {
  LOCALE,
  formatAmount,
  formatNumberWith,
  getNumberFormat,
} from "@/utils/numberFormat";
import {
  formatCurrency,
  formatCurrencyCUP,
  formatCurrencyInteger,
  formatDecimal,
  formatMontoEnMoneda,
  formatNumber,
  formatPercentage,
} from "@/utils/formatters";

// Money is the one thing that must not change shape. A cached formatter that
// swapped the decimal comma for a point would misprice every screen in the
// app, so every value below is checked against the raw `toLocaleString` the
// code used before the cache existed.
const VALUES = [
  0, 1, -1, 0.005, 0.5, 1.005, 12.34, -12.34, 1234.5, 1234567.891, 1e-16,
  -1e-16, 999999999.99,
];

describe("getNumberFormat", () => {
  it("returns the very same instance for equal options", () => {
    const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    expect(getNumberFormat(LOCALE, options)).toBe(
      getNumberFormat(LOCALE, { ...options }),
    );
  });

  it("does not share an instance across different options", () => {
    expect(getNumberFormat(LOCALE, { maximumFractionDigits: 0 })).not.toBe(
      getNumberFormat(LOCALE, { maximumFractionDigits: 2 }),
    );
  });
});

describe("formatAmount", () => {
  it.each(VALUES)("matches toLocaleString for %s", (value) => {
    expect(formatAmount(value)).toBe(
      value.toLocaleString(LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  });
});

describe("formatNumberWith", () => {
  it.each(VALUES)("matches toLocaleString with no decimals for %s", (value) => {
    const options = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    };
    expect(formatNumberWith(value, options)).toBe(
      value.toLocaleString(LOCALE, options),
    );
  });
});

// The public helpers keep their exact output; only what they use underneath
// changed.
describe("formatters keep their output", () => {
  it.each(VALUES)("formatCurrency(%s)", (value) => {
    const expected = value
      ? `$${value.toLocaleString(LOCALE, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : "$0.00";
    expect(formatCurrency(value)).toBe(expected);
  });

  it.each(VALUES)("formatMontoEnMoneda(%s)", (value) => {
    expect(formatMontoEnMoneda(value, "CUP")).toBe(
      `${(value || 0).toLocaleString(LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} CUP`,
    );
  });

  it.each(VALUES)("formatCurrencyCUP(%s)", (value) => {
    expect(formatCurrencyCUP(value)).toBe(
      `${value.toLocaleString(LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} CUP`,
    );
  });

  it.each(VALUES)("formatCurrencyInteger(%s)", (value) => {
    expect(formatCurrencyInteger(value)).toBe(
      `$${value.toLocaleString(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`,
    );
  });

  it.each(VALUES)("formatNumber(%s)", (value) => {
    expect(formatNumber(value)).toBe(
      value.toLocaleString(LOCALE, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    );
  });

  it.each([0, 2, 4])("formatDecimal with %s decimals", (decimals) => {
    for (const value of VALUES) {
      expect(formatDecimal(value, decimals)).toBe(
        value.toLocaleString(LOCALE, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }),
      );
    }
  });

  it.each([0, 1, 2])("formatPercentage with %s decimals", (decimals) => {
    for (const value of VALUES) {
      expect(formatPercentage(value, decimals)).toBe(
        `${value.toLocaleString(LOCALE, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })}%`,
      );
    }
  });
});
