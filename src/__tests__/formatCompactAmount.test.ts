import { describe, expect, it } from "vitest";

import { formatCompactAmount, formatCurrencyCompact } from "@/utils/formatters";

describe("formatCompactAmount", () => {
  // Spanish grouping leaves four-digit integers ungrouped ("4500", not
  // "4.500"), which is why the compact tier starts at five digits.
  it("leaves small amounts alone — they already fit", () => {
    expect(formatCompactAmount(7.6)).toBe("7,60");
    expect(formatCompactAmount(4500)).toBe("4500,00");
    expect(formatCompactAmount(9999)).toBe("9999,00");
  });

  it("abbreviates thousands from five digits up", () => {
    expect(formatCompactAmount(10_000)).toBe("10 mil");
    expect(formatCompactAmount(45_500)).toBe("45,5 mil");
  });

  it("abbreviates millions", () => {
    expect(formatCompactAmount(2_893_000)).toBe("2,89 MM");
  });

  it("abbreviates thousands of millions", () => {
    expect(formatCompactAmount(20_015_010_459.71)).toBe("20,02 MMM");
  });

  it("keeps the sign on negatives", () => {
    expect(formatCompactAmount(-2_893_000)).toBe("-2,89 MM");
  });

  it("treats zero and nullish input as zero", () => {
    expect(formatCompactAmount(0)).toBe("0,00");
    expect(formatCompactAmount(NaN)).toBe("0,00");
  });

  it("prefixes the base-currency symbol", () => {
    expect(formatCurrencyCompact(20_015_010_459.71)).toBe("$20,02 MMM");
    expect(formatCurrencyCompact(7.6)).toBe("$7,60");
  });
});
