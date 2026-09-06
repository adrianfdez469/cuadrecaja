import { describe, it, expect } from "vitest";
import { formatQabSsoExpiry } from "@/utils/tiendaOnlineSsoCopy";

/**
 * F-009 — `formatQabSsoExpiry`, added in step 4b (§ 9.4 of the contract). Pure countdown label:
 * `Caduca en {n} s` with `n = Math.max(0, Math.floor(secondsLeft))`. Its own JSDoc is explicit
 * that a negative or fractional input must be floored AND clamped — a throttled background tab
 * must never render `Caduca en -3 s`.
 */

describe("formatQabSsoExpiry", () => {
  it("should render the whole-second countdown for an integer input", () => {
    expect(formatQabSsoExpiry(55)).toBe("Caduca en 55 s");
  });

  it("should FLOOR a fractional input, not round it (4.9 -> 4, not 5)", () => {
    expect(formatQabSsoExpiry(4.9)).toBe("Caduca en 4 s");
  });

  it("should render 0 for an input of exactly 0", () => {
    expect(formatQabSsoExpiry(0)).toBe("Caduca en 0 s");
  });

  it("should CLAMP a negative input to 0, never a negative number", () => {
    expect(formatQabSsoExpiry(-3)).toBe("Caduca en 0 s");
  });

  it("should clamp a small negative fractional input to 0 too", () => {
    expect(formatQabSsoExpiry(-0.5)).toBe("Caduca en 0 s");
  });

  it("should NOT pluralise: the same 's' suffix is used for 1 as for any other count", () => {
    expect(formatQabSsoExpiry(1)).toBe("Caduca en 1 s");
  });

  it("should not format the number with any locale grouping (e.g. no dot/comma at four digits)", () => {
    expect(formatQabSsoExpiry(1234)).toBe("Caduca en 1234 s");
  });
});
