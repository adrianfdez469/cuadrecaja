import { describe, it, expect } from "vitest";
import { formatQuantity } from "@/utils/formatters";

describe("formatQuantity", () => {
  it("leaves a whole count alone", () => {
    expect(formatQuantity(3)).toBe("3");
    expect(formatQuantity(1111)).toBe("1111");
  });

  it("keeps up to 2 decimals without padding", () => {
    expect(formatQuantity(2.5)).toBe("2.5");
    expect(formatQuantity(12.75)).toBe("12.75");
  });

  it("clears the float noise real stock carries", () => {
    // Both are actual `ProductoTienda.existencia` values in production.
    expect(formatQuantity(8.69999999999999)).toBe("8.7");
    expect(formatQuantity(12.6000000000001)).toBe("12.6");
  });

  it("rounds anything finer than a hundredth", () => {
    expect(formatQuantity(1 / 3)).toBe("0.33");
    expect(formatQuantity(2.999)).toBe("3");
  });

  it("shows a negative residue as zero, not '-0'", () => {
    // Repeated additions and subtractions leave stock at -8.88e-16.
    expect(formatQuantity(-8.88178419700125e-16)).toBe("0");
  });

  it("survives a missing quantity", () => {
    expect(formatQuantity(undefined as unknown as number)).toBe("0");
    expect(formatQuantity(null as unknown as number)).toBe("0");
  });
});
