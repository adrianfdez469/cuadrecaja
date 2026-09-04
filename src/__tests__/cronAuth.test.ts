import { describe, it, expect } from "vitest";
import { isValidCronAuth } from "@/lib/cronAuth";

/**
 * F-019 — `isValidCronAuth` (contract § 3, ADR 0042). Moved verbatim out of
 * `sync-tienda`'s route (F-002 criterion 1), so this file also re-verifies
 * that criterion now that the function lives in a shared module — a closed
 * feature whose code moves is not verified by its own closing report anymore
 * (contract § 15, last paragraph).
 */
describe("isValidCronAuth", () => {
  const secret = "s3cr3t-cron-value";
  const validHeader = `Bearer ${secret}`;

  it("should reject a missing Authorization header when a secret IS configured", () => {
    expect(isValidCronAuth(null, secret)).toBe(false);
  });

  it("should accept the exact expected header", () => {
    expect(isValidCronAuth(validHeader, secret)).toBe(true);
  });

  it("should reject an incorrect header of the SAME length as the expected one", () => {
    const wrongSameLength = `${validHeader.slice(0, -2)}xx`;
    expect(wrongSameLength.length).toBe(validHeader.length);
    expect(isValidCronAuth(wrongSameLength, secret)).toBe(false);
  });

  it("should reject a header of a DIFFERENT length without throwing", () => {
    // The case that would make timingSafeEqual throw a RangeError if the
    // length guard were missing or evaluated after the comparison.
    const shorterHeader = validHeader.slice(0, -1);
    expect(() => isValidCronAuth(shorterHeader, secret)).not.toThrow();
    expect(isValidCronAuth(shorterHeader, secret)).toBe(false);

    const longerHeader = `${validHeader}x`;
    expect(() => isValidCronAuth(longerHeader, secret)).not.toThrow();
    expect(isValidCronAuth(longerHeader, secret)).toBe(false);
  });

  it("should fail-closed on an undefined secret even against the literal 'Bearer undefined' header", () => {
    // The exact case that distinguishes this cron family from the two
    // fail-open crons (purge-expired-idempotency-keys,
    // purge-expired-freemium-landing-business), whose
    // `!== \`Bearer ${process.env.CRON_SECRET}\`` check would let this through.
    expect(isValidCronAuth("Bearer undefined", undefined)).toBe(false);
  });

  it("should fail-closed on an undefined secret regardless of the header, including no header at all", () => {
    expect(isValidCronAuth(null, undefined)).toBe(false);
  });

  it("should fail-closed on an empty-string secret (falsy, same branch as undefined)", () => {
    expect(isValidCronAuth(validHeader, "")).toBe(false);
  });

  it("should reject a header missing the 'Bearer ' prefix even carrying the right secret", () => {
    expect(isValidCronAuth(secret, secret)).toBe(false);
  });
});
