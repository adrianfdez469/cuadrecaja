import { describe, it, expect } from "vitest";
import {
  resolveQabSsoSecret,
  resolveQabSsoAvailability,
  qabSsoAdminUrl,
  QabSsoConfigError,
} from "@/lib/qab/qabSsoEnv";
import {
  QAB_SSO_ADMIN_PATH,
  QAB_SSO_SECRET_MIN_LENGTH,
  QAB_SSO_UNAVAILABLE_REASONS,
} from "@/constants/qabSso";

/**
 * F-009 — `src/lib/qab/qabSsoEnv.ts` (§ 3 of the contract, ADR 0068). `resolveQabSsoSecret` and
 * `resolveQabSsoAvailability` are pure: both take the environment as an argument, exactly like
 * `resolveQabBaseUrl` (F-002) and `resolveQabProvisioningSecret` (F-003), so this suite drives
 * all four unavailability reasons without ever touching `process.env`.
 *
 * This module is the ONLY reader of SSO_JWT_SECRET (contract § 3): unlike the provisioning
 * secret, the contract does NOT require a printable-ASCII/no-whitespace pattern for this one —
 * only a minimum length. A test asserting a pattern rejection here would test a rule the
 * contract never asked for.
 */

const validSecret = "s".repeat(QAB_SSO_SECRET_MIN_LENGTH);
const validBaseUrlEnv = { QAB_API_BASE_URL: "https://queandabuscando.example" };

describe("resolveQabSsoSecret", () => {
  it("should return null when SSO_JWT_SECRET is absent", () => {
    expect(resolveQabSsoSecret({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("should return null when SSO_JWT_SECRET is blank after trimming", () => {
    expect(
      resolveQabSsoSecret({ SSO_JWT_SECRET: "   " } as unknown as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("should return the trimmed secret when it is valid, with surrounding whitespace stripped", () => {
    expect(
      resolveQabSsoSecret({ SSO_JWT_SECRET: `  ${validSecret}  ` } as unknown as NodeJS.ProcessEnv),
    ).toBe(validSecret);
  });

  it(`should accept a secret of exactly ${QAB_SSO_SECRET_MIN_LENGTH} characters (inclusive boundary)`, () => {
    const boundary = "a".repeat(QAB_SSO_SECRET_MIN_LENGTH);
    expect(
      resolveQabSsoSecret({ SSO_JWT_SECRET: boundary } as unknown as NodeJS.ProcessEnv),
    ).toBe(boundary);
  });

  it(`should throw QabSsoConfigError for a secret of ${QAB_SSO_SECRET_MIN_LENGTH - 1} characters`, () => {
    const tooShort = "a".repeat(QAB_SSO_SECRET_MIN_LENGTH - 1);
    expect(() =>
      resolveQabSsoSecret({ SSO_JWT_SECRET: tooShort } as unknown as NodeJS.ProcessEnv),
    ).toThrow(QabSsoConfigError);
  });

  it("should NEVER include the secret's value in the thrown error's message (E-031)", () => {
    const tooShort = "a".repeat(QAB_SSO_SECRET_MIN_LENGTH - 1);
    try {
      resolveQabSsoSecret({ SSO_JWT_SECRET: tooShort } as unknown as NodeJS.ProcessEnv);
      expect.fail("expected resolveQabSsoSecret to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabSsoConfigError);
      const message = (error as Error).message;
      expect(message).not.toContain(tooShort);
    }
  });

  it("should NEVER include the secret's length as a bare number matching the input's own length", () => {
    // A message like "got 31 characters" would still be citing the datum that broke it, just
    // one step removed (E-031 by the length route instead of the value route). The contract
    // only allows naming the variable and the MINIMUM length, never the length of what arrived.
    const tooShort = "a".repeat(17);
    try {
      resolveQabSsoSecret({ SSO_JWT_SECRET: tooShort } as unknown as NodeJS.ProcessEnv);
      expect.fail("expected resolveQabSsoSecret to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).not.toMatch(/\b17\b/);
    }
  });

  it("should default to process.env when called without an argument", () => {
    const original = process.env.SSO_JWT_SECRET;
    delete process.env.SSO_JWT_SECRET;
    try {
      expect(resolveQabSsoSecret()).toBeNull();
    } finally {
      if (original === undefined) delete process.env.SSO_JWT_SECRET;
      else process.env.SSO_JWT_SECRET = original;
    }
  });
});

describe("resolveQabSsoAvailability", () => {
  it("should never throw, even with a garbage environment", () => {
    expect(() =>
      resolveQabSsoAvailability({
        SSO_JWT_SECRET: "too-short",
        QAB_API_BASE_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("should report SECRET_NOT_SET when the secret is absent and the base URL is valid", () => {
    expect(
      resolveQabSsoAvailability(validBaseUrlEnv as unknown as NodeJS.ProcessEnv),
    ).toEqual({ available: false, reason: "SECRET_NOT_SET" });
  });

  it("should report SECRET_INVALID when the secret is present but too short, and the base URL is valid", () => {
    expect(
      resolveQabSsoAvailability({
        ...validBaseUrlEnv,
        SSO_JWT_SECRET: "too-short",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ available: false, reason: "SECRET_INVALID" });
  });

  it("should report BASE_URL_NOT_SET when the secret is valid and the base URL is absent", () => {
    expect(
      resolveQabSsoAvailability({
        SSO_JWT_SECRET: validSecret,
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ available: false, reason: "BASE_URL_NOT_SET" });
  });

  it("should report BASE_URL_INVALID when the secret is valid and the base URL does not parse", () => {
    expect(
      resolveQabSsoAvailability({
        SSO_JWT_SECRET: validSecret,
        QAB_API_BASE_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ available: false, reason: "BASE_URL_INVALID" });
  });

  it("should return available: true with the resolved secret and baseUrl when both are valid", () => {
    expect(
      resolveQabSsoAvailability({
        ...validBaseUrlEnv,
        SSO_JWT_SECRET: validSecret,
      } as unknown as NodeJS.ProcessEnv),
    ).toEqual({ available: true, secret: validSecret, baseUrl: "https://queandabuscando.example" });
  });

  // Precedence (contract § 3 and ADR 0068): with BOTH variables broken at once, the secret's
  // reason must win because QAB_SSO_UNAVAILABLE_REASONS declares it first. Asserted against the
  // array's own indices rather than a copied literal, so a reordering of the contract's array
  // is what this test tracks — not a hardcoded guess.
  describe("precedence when both variables are broken at once", () => {
    const secretNotSetReason = QAB_SSO_UNAVAILABLE_REASONS[0]; // "SECRET_NOT_SET"
    const secretInvalidReason = QAB_SSO_UNAVAILABLE_REASONS[1]; // "SECRET_INVALID"

    it("secret absent + base URL absent -> reports the secret-absent reason", () => {
      expect(resolveQabSsoAvailability({} as unknown as NodeJS.ProcessEnv)).toEqual({
        available: false,
        reason: secretNotSetReason,
      });
    });

    it("secret absent + base URL invalid -> STILL reports the secret-absent reason, not the URL's", () => {
      expect(
        resolveQabSsoAvailability({
          QAB_API_BASE_URL: "not a url",
        } as unknown as NodeJS.ProcessEnv),
      ).toEqual({ available: false, reason: secretNotSetReason });
    });

    it("secret invalid + base URL absent -> reports the secret-invalid reason", () => {
      expect(
        resolveQabSsoAvailability({
          SSO_JWT_SECRET: "too-short",
        } as unknown as NodeJS.ProcessEnv),
      ).toEqual({ available: false, reason: secretInvalidReason });
    });

    it("secret invalid + base URL invalid -> STILL reports the secret-invalid reason, not the URL's", () => {
      expect(
        resolveQabSsoAvailability({
          SSO_JWT_SECRET: "too-short",
          QAB_API_BASE_URL: "not a url",
        } as unknown as NodeJS.ProcessEnv),
      ).toEqual({ available: false, reason: secretInvalidReason });
    });
  });
});

describe("qabSsoAdminUrl", () => {
  it("should append QAB_SSO_ADMIN_PATH and the token as a query parameter", () => {
    const url = qabSsoAdminUrl("https://queandabuscando.example", "abc.def.ghi");
    expect(url).toBe(
      `https://queandabuscando.example${QAB_SSO_ADMIN_PATH}?token=abc.def.ghi`,
    );
  });

  it("should url-encode a token that contains characters unsafe in a query string", () => {
    const url = qabSsoAdminUrl("https://queandabuscando.example", "a+b/c=d");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("token")).toBe("a+b/c=d");
  });

  it("should not double a slash when concatenating", () => {
    const url = qabSsoAdminUrl("https://queandabuscando.example", "tok");
    expect(url).not.toMatch(/\/\/admin/);
  });
});
