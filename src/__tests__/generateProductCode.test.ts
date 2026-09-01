import { describe, expect, it } from "vitest";
import generateEAN13, {
  isGeneratedProductCode,
} from "@/utils/generateProductCode";
import { GENERATED_CODE_PREFIX } from "@/constants/productCodes";

function isValidEAN13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10 === parseInt(code[12], 10);
}

describe("generateEAN13", () => {
  it("generates a valid 13-digit EAN with the restricted-circulation prefix", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateEAN13(new Set());
      expect(code).toHaveLength(13);
      expect(code.startsWith(GENERATED_CODE_PREFIX)).toBe(true);
      expect(isValidEAN13(code)).toBe(true);
    }
  });

  it("never returns a code already taken", () => {
    const existing = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const code = generateEAN13(existing);
      expect(existing.has(code)).toBe(false);
      existing.add(code);
    }
  });

  it("throws when it cannot find a free code", () => {
    const alwaysTaken = { has: () => true } as unknown as Set<string>;
    expect(() => generateEAN13(alwaysTaken, 5)).toThrow();
  });
});

describe("isGeneratedProductCode", () => {
  it("recognises codes produced by the generator", () => {
    expect(isGeneratedProductCode(generateEAN13(new Set()))).toBe(true);
  });

  it("rejects real manufacturer barcodes", () => {
    // Argentina (779), Spain (841), USA/UPC-A padded, short and non-numeric codes
    expect(isGeneratedProductCode("7790895000997")).toBe(false);
    expect(isGeneratedProductCode("8410000000007")).toBe(false);
    expect(isGeneratedProductCode("0123456789012")).toBe(false);
    expect(isGeneratedProductCode("04012345")).toBe(false);
    expect(isGeneratedProductCode("040ABCDEFGHIJ")).toBe(false);
  });
});
