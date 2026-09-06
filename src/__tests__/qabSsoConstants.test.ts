import { describe, it, expect } from "vitest";
import {
  QAB_SSO_ADMIN_PATH,
  QAB_SSO_TOKEN_QUERY_KEY,
  QAB_SSO_TOKEN_TTL_SECONDS,
  QAB_SSO_LINK_UI_TTL_SECONDS,
  QAB_SSO_ALGORITHM,
  QAB_SSO_SECRET_MIN_LENGTH,
  QAB_SSO_UNAVAILABLE_REASONS,
  QAB_SSO_NOT_CONFIGURED_LOG,
  QAB_SSO_SIGNING_FAILED,
} from "@/constants/qabSso";

/**
 * F-009 — `src/constants/qabSso.ts` (§ 1 of the contract). These are the plain values QAB's
 * assertion is built from; every other module of the feature reads them instead of repeating
 * a literal, so a wrong value here would silently drift into the token, the URL and the log
 * line all at once.
 */

describe("QAB SSO constants", () => {
  it("should point the admin path at /admin/sso, QAB's redemption route", () => {
    expect(QAB_SSO_ADMIN_PATH).toBe("/admin/sso");
  });

  it("should carry the token in the 'token' query key", () => {
    expect(QAB_SSO_TOKEN_QUERY_KEY).toBe("token");
  });

  it("should fix the assertion's lifetime at exactly 60 seconds", () => {
    expect(QAB_SSO_TOKEN_TTL_SECONDS).toBe(60);
  });

  it("should pin the signing algorithm to HS256", () => {
    expect(QAB_SSO_ALGORITHM).toBe("HS256");
  });

  it("should require at least 32 characters for SSO_JWT_SECRET", () => {
    expect(QAB_SSO_SECRET_MIN_LENGTH).toBe(32);
  });

  it("should carry the fixed log prefix for a not-configured environment", () => {
    expect(QAB_SSO_NOT_CONFIGURED_LOG).toBe("QAB_SSO_NOT_CONFIGURED");
  });

  it("should carry the fixed message of a signing failure", () => {
    expect(QAB_SSO_SIGNING_FAILED).toBe("QAB_SSO_SIGNING_FAILED");
  });

  describe("QAB_SSO_LINK_UI_TTL_SECONDS", () => {
    // The JSDoc of the contract is explicit that 55 is not a typo for 60: the screen gives up
    // five seconds of useful life so it can never hand out a link that already expired by the
    // time the response lands. A test that "fixed" this to 60 would defeat the whole point of
    // the constant, so it asserts the exact value AND the relationship to the token's TTL.
    it("should be exactly 55, not the token's own TTL", () => {
      expect(QAB_SSO_LINK_UI_TTL_SECONDS).toBe(55);
    });

    it("should be strictly less than QAB_SSO_TOKEN_TTL_SECONDS", () => {
      expect(QAB_SSO_LINK_UI_TTL_SECONDS).toBeLessThan(QAB_SSO_TOKEN_TTL_SECONDS);
    });
  });

  describe("QAB_SSO_UNAVAILABLE_REASONS", () => {
    // Declaration order IS the precedence resolveQabSsoAvailability walks (§ 1 of the
    // contract): with the secret AND the base URL both broken, the secret's reason must win
    // because it is declared first. This test locks the order, not just the membership.
    it("should declare the secret's two reasons before the base URL's two reasons", () => {
      expect(QAB_SSO_UNAVAILABLE_REASONS).toEqual([
        "SECRET_NOT_SET",
        "SECRET_INVALID",
        "BASE_URL_NOT_SET",
        "BASE_URL_INVALID",
      ]);
    });

    it("should expose exactly four reasons, the closed vocabulary", () => {
      expect(QAB_SSO_UNAVAILABLE_REASONS).toHaveLength(4);
    });
  });
});
