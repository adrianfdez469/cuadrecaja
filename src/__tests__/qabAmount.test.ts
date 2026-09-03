import { describe, it, expect } from "vitest";
import { qabAmountSchema, qabQuantitySchema } from "@/schemas/qabAmount";

/**
 * F-001 — the edge where QAB wire money enters cuadrecaja.
 *
 * The contract (§ src/schemas/qabAmount.ts) fixes the normalization rule literally, and these
 * tests are written against that rule, not against the implementation:
 *
 *  - a `number` input must satisfy `Number(n.toFixed(2)) === n`, which is what rejects 2.675 —
 *    the exact divergent-rounding case the contract documents (JS serializes "2.67", Postgres
 *    rounds to 2.68, and that product never converges again);
 *  - a `string` input is trimmed and must match /^-?\d+(\.\d{1,2})?$/;
 *  - the output always carries EXACTLY two decimals, so that "880" and "880.00" become the same
 *    stored value in a Decimal(14,2) column (criterion 4 of F-010);
 *  - there is no negative zero.
 *
 * Quantities are the same idea with three decimals and no sign at all.
 */

describe("qabAmountSchema", () => {
  it("should produce the same value for '880' and '880.00' (F-010 criterion 4)", () => {
    const withoutDecimals = qabAmountSchema.parse("880");
    const withDecimals = qabAmountSchema.parse("880.00");

    expect(withoutDecimals).toBe("880.00");
    expect(withDecimals).toBe("880.00");
    expect(withoutDecimals).toBe(withDecimals);
  });

  const acceptedStrings: Array<[string, string]> = [
    ["880", "880.00"],
    ["880.00", "880.00"],
    ["880.5", "880.50"],
    ["1990.5", "1990.50"],
    ["1990.10", "1990.10"],
    ["1990.00", "1990.00"],
    ["0", "0.00"],
    ["0.00", "0.00"],
    ["0.0", "0.00"],
    ["-5.5", "-5.50"],
    ["-1990.10", "-1990.10"],
    ["99999999999.99", "99999999999.99"],
    ["  880  ", "880.00"],
  ];

  it.each(acceptedStrings)(
    "should normalize the string %s to %s",
    (input, expected) => {
      expect(qabAmountSchema.parse(input)).toBe(expected);
    }
  );

  const negativeZeros: string[] = ["-0", "-0.0", "-0.00"];

  it.each(negativeZeros)(
    "should normalize %s to '0.00': there is no negative zero",
    (input) => {
      expect(qabAmountSchema.parse(input)).toBe("0.00");
    }
  );

  const acceptedNumbers: Array<[number, string]> = [
    [880, "880.00"],
    [1990.1, "1990.10"],
    [1990.5, "1990.50"],
    [0, "0.00"],
    [-0, "0.00"],
    [-5.5, "-5.50"],
    [2.5, "2.50"],
  ];

  it.each(acceptedNumbers)(
    "should normalize the number %s to %s",
    (input, expected) => {
      expect(qabAmountSchema.parse(input)).toBe(expected);
    }
  );

  it("should reject the number 2.675, the divergent-rounding case of the contract", () => {
    // (2.675).toFixed(2) === "2.67" in JavaScript, round(2.675, 2) === 2.68 in Postgres.
    // Accepting it would silently desynchronize both sides forever.
    expect(qabAmountSchema.safeParse(2.675).success).toBe(false);
  });

  it("should reject a float that does not survive its own two-decimal rendering", () => {
    expect(qabAmountSchema.safeParse(0.1 + 0.2).success).toBe(false);
  });

  const invalidAmounts: Array<[string, unknown]> = [
    ["a string with three decimals", "1.234"],
    ["an empty string", ""],
    ["a blank string", " "],
    ["a comma decimal separator", "1,5"],
    ["scientific notation", "1e3"],
    ["a non numeric string", "abc"],
    ["an explicit plus sign", "+1"],
    ["a lone dot", "."],
    ["a trailing dot", "880."],
    ["a leading dot", ".5"],
    ["a lone minus sign", "-"],
    ["a currency suffix", "880 CUP"],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
    ["an array", []],
    ["a boolean", true],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["a bigint", BigInt(880)],
  ];

  it.each(invalidAmounts)("should reject %s", (_label, value) => {
    expect(qabAmountSchema.safeParse(value).success).toBe(false);
  });

  it("should always return a string, never a number", () => {
    expect(typeof qabAmountSchema.parse(880)).toBe("string");
    expect(typeof qabAmountSchema.parse("880")).toBe("string");
  });

  it("should keep amounts comparable as numbers, never as strings", () => {
    // The operative rule of the contract: "880.00" < "9.00" lexicographically, and that is a bug.
    const bigger = qabAmountSchema.parse("880");
    const smaller = qabAmountSchema.parse("9");

    expect(Number(bigger) > Number(smaller)).toBe(true);
  });
});

describe("qabQuantitySchema", () => {
  const acceptedQuantities: Array<[string, string]> = [
    ["2", "2.000"],
    ["2.000", "2.000"],
    ["2.0", "2.000"],
    ["2.5", "2.500"],
    ["0", "0.000"],
    ["0.001", "0.001"],
    ["  2  ", "2.000"],
  ];

  it.each(acceptedQuantities)(
    "should normalize the string %s to %s",
    (input, expected) => {
      expect(qabQuantitySchema.parse(input)).toBe(expected);
    }
  );

  it("should normalize the number 2 to '2.000'", () => {
    expect(qabQuantitySchema.parse(2)).toBe("2.000");
  });

  const invalidQuantities: Array<[string, unknown]> = [
    ["a string with four decimals", "2.0001"],
    ["a negative quantity", "-1"],
    ["a negative quantity with decimals", "-1.500"],
    ["a negative zero", "-0"],
    ["a negative number", -1],
    ["an empty string", ""],
    ["a blank string", " "],
    ["a comma decimal separator", "1,5"],
    ["scientific notation", "1e3"],
    ["a non numeric string", "abc"],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
    ["a boolean", true],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ];

  it.each(invalidQuantities)("should reject %s", (_label, value) => {
    expect(qabQuantitySchema.safeParse(value).success).toBe(false);
  });

  it("should always return a string with exactly three decimals", () => {
    const parsed = qabQuantitySchema.parse("2");

    expect(typeof parsed).toBe("string");
    expect(parsed.split(".")[1]).toHaveLength(3);
  });
});
