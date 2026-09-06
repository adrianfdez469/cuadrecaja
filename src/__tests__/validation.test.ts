import { describe, it, expect } from "vitest";
import { EMAIL_REGEX } from "@/constants/validation";

/**
 * F-023 — `src/constants/validation.ts` (§ 1.1 of the contract, ADR 0087). THE only definition
 * of the "looks like an address" pattern under `src/`, imported by the seven gates that used to
 * repeat it literal (five under the name `EMAIL_REGEX`, two under `EMAIL_PATTERN`) and by
 * `isQabSsoIssuableEmail` (`src/__tests__/qabSsoClaims.test.ts`). This is the first test that
 * fixes the constant's own behaviour; it does not exercise any of the seven call sites, which
 * are not this feature's territory — only that they all import this one symbol is checked by
 * the `grep` the contract hands to `qa` (§ 6).
 */

describe("EMAIL_REGEX", () => {
  it("should match a well-formed address", () => {
    expect(EMAIL_REGEX.test("admin@example.com")).toBe(true);
  });

  it("should reject a string without an @ (criterion 6's second case)", () => {
    expect(EMAIL_REGEX.test("admin")).toBe(false);
  });

  it("should reject a string with an @ but no dot after it (criterion 6's third case)", () => {
    expect(EMAIL_REGEX.test("admin@localhost")).toBe(false);
  });

  it("should reject an empty string (criterion 6's fourth case)", () => {
    expect(EMAIL_REGEX.test("")).toBe(false);
  });

  it("should reject a string whose only dot is BEFORE the @, not after it", () => {
    expect(EMAIL_REGEX.test("admin.name@localhost")).toBe(false);
  });

  it("should reject a string with no local part before the @", () => {
    expect(EMAIL_REGEX.test("@example.com")).toBe(false);
  });

  it("should reject a string containing whitespace", () => {
    expect(EMAIL_REGEX.test("admin name@example.com")).toBe(false);
  });

  it("should NOT carry the global flag: a shared `g` instance would alternate results across calls via lastIndex (ADR 0087)", () => {
    expect(EMAIL_REGEX.global).toBe(false);
    // The behavioural proof, not just the flag: two consecutive .test() calls on the SAME
    // input must both return true. A global regex advances lastIndex on the first call and
    // would flip to false on the second for this very string, which is exactly the bug the
    // ADR calls out when a single instance is shared across eight modules.
    expect(EMAIL_REGEX.test("admin@example.com")).toBe(true);
    expect(EMAIL_REGEX.test("admin@example.com")).toBe(true);
  });
});
