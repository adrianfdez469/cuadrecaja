import { describe, it, expect } from "vitest";
import {
  resolveQabProvisioningSecret,
  isUsableQabProvisioningSecret,
  qabProvisioningCredentialUrl,
  resolveAutoProvisioningAvailability,
  QabProvisioningConfigError,
} from "@/lib/qab/qabProvisioningEnv";
import {
  QAB_PROVISIONING_CREDENTIAL_PATH,
  QAB_PROVISIONING_SECRET_MIN_LENGTH,
  QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS,
} from "@/constants/qabProvisioning";

/**
 * F-003 — `src/lib/qab/qabProvisioningEnv.ts`. Both functions are pure per the contract
 * (they take the environment as an argument, like `resolveQabBaseUrl` from F-002).
 *
 * This is one of the three places a bearer value can enter the system (ADR 0026, point 4):
 * a secret with an embedded newline, carriage return or internal space would end up
 * concatenated verbatim into `Authorization: Bearer ${secret}` — header injection. The
 * "internal" qualifier matters: trimming removes LEADING/TRAILING whitespace, so the
 * regression case here plants the bad character in the MIDDLE of an otherwise valid-length
 * string, which trimming cannot fix and only the pattern check can catch.
 */

// A valid secret is printable ASCII, no whitespace, at least QAB_PROVISIONING_SECRET_MIN_LENGTH long.
const validSecret = "s3cr3t-" + "a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH - "s3cr3t-".length);

function withInternalChar(char: string): string {
  // Length stays >= MIN_LENGTH so a failure can only be attributed to the pattern, never to length.
  const half = Math.floor(QAB_PROVISIONING_SECRET_MIN_LENGTH / 2);
  return "a".repeat(half) + char + "a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH - half);
}

describe("resolveQabProvisioningSecret", () => {
  it("should return null when QAB_PROVISIONING_SECRET is absent", () => {
    expect(resolveQabProvisioningSecret({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("should return null when QAB_PROVISIONING_SECRET is blank after trimming", () => {
    expect(
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: "   ",
      } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
  });

  it("should return the trimmed secret when it is valid, with surrounding whitespace stripped", () => {
    expect(
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: `  ${validSecret}  `,
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(validSecret);
  });

  it(`should accept a secret of exactly ${QAB_PROVISIONING_SECRET_MIN_LENGTH} characters (inclusive boundary)`, () => {
    const boundary = "a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH);
    expect(
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: boundary,
      } as unknown as NodeJS.ProcessEnv)
    ).toBe(boundary);
  });

  it(`should throw QabProvisioningConfigError for a secret of ${QAB_PROVISIONING_SECRET_MIN_LENGTH - 1} characters`, () => {
    const tooShort = "a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH - 1);
    expect(() =>
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: tooShort,
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabProvisioningConfigError);
  });

  it("should throw QabProvisioningConfigError for a secret with an internal newline (header injection)", () => {
    expect(() =>
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: withInternalChar("\n"),
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabProvisioningConfigError);
  });

  it("should throw QabProvisioningConfigError for a secret with an internal carriage return", () => {
    expect(() =>
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: withInternalChar("\r"),
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabProvisioningConfigError);
  });

  it("should throw QabProvisioningConfigError for a secret with an internal space", () => {
    expect(() =>
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: withInternalChar(" "),
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabProvisioningConfigError);
  });

  it("should throw QabProvisioningConfigError for a secret with a non-ASCII character", () => {
    expect(() =>
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: withInternalChar("é"),
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabProvisioningConfigError);
  });

  it("should NEVER include the secret's value in the thrown error's message", () => {
    const badSecret = withInternalChar("\n");
    try {
      resolveQabProvisioningSecret({
        QAB_PROVISIONING_SECRET: badSecret,
      } as unknown as NodeJS.ProcessEnv);
      expect.fail("expected resolveQabProvisioningSecret to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabProvisioningConfigError);
      const message = (error as Error).message;
      expect(message).not.toContain(badSecret);
      expect(message).not.toContain(badSecret.trim());
    }
  });

  it("should default to process.env when called without an argument", () => {
    const original = process.env.QAB_PROVISIONING_SECRET;
    delete process.env.QAB_PROVISIONING_SECRET;
    try {
      expect(resolveQabProvisioningSecret()).toBeNull();
    } finally {
      if (original === undefined) delete process.env.QAB_PROVISIONING_SECRET;
      else process.env.QAB_PROVISIONING_SECRET = original;
    }
  });
});

describe("isUsableQabProvisioningSecret", () => {
  it("should return false for null", () => {
    expect(isUsableQabProvisioningSecret(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isUsableQabProvisioningSecret(undefined)).toBe(false);
  });

  it("should return false for an empty string", () => {
    expect(isUsableQabProvisioningSecret("")).toBe(false);
  });

  it(`should return false for a string shorter than ${QAB_PROVISIONING_SECRET_MIN_LENGTH} characters`, () => {
    expect(isUsableQabProvisioningSecret("a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH - 1))).toBe(
      false
    );
  });

  it("should return false for a long-enough value with an internal newline", () => {
    expect(isUsableQabProvisioningSecret(withInternalChar("\n"))).toBe(false);
  });

  it("should return false for a long-enough value with an internal space", () => {
    expect(isUsableQabProvisioningSecret(withInternalChar(" "))).toBe(false);
  });

  it("should return true for a valid secret", () => {
    expect(isUsableQabProvisioningSecret(validSecret)).toBe(true);
  });

  it(`should return true at exactly the ${QAB_PROVISIONING_SECRET_MIN_LENGTH}-character boundary`, () => {
    expect(isUsableQabProvisioningSecret("a".repeat(QAB_PROVISIONING_SECRET_MIN_LENGTH))).toBe(true);
  });
});

describe("qabProvisioningCredentialUrl", () => {
  it("should append QAB_PROVISIONING_CREDENTIAL_PATH to the resolved origin", () => {
    expect(qabProvisioningCredentialUrl("https://queandabuscando.example")).toBe(
      `https://queandabuscando.example${QAB_PROVISIONING_CREDENTIAL_PATH}`
    );
  });

  it("should not double a slash when concatenating", () => {
    expect(qabProvisioningCredentialUrl("https://queandabuscando.example")).not.toMatch(
      /\/\/api/
    );
  });
});

describe("resolveAutoProvisioningAvailability", () => {
  const validBaseUrlEnv = { QAB_API_BASE_URL: "https://queandabuscando.example" };

  it("should never throw, even with a garbage environment", () => {
    expect(() =>
      resolveAutoProvisioningAvailability({
        QAB_PROVISIONING_SECRET: "\n\n\n",
        QAB_API_BASE_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it("should report SECRET_NOT_SET when the secret is absent and the base URL is valid", () => {
    expect(
      resolveAutoProvisioningAvailability(validBaseUrlEnv as unknown as NodeJS.ProcessEnv)
    ).toEqual({ available: false, reason: "SECRET_NOT_SET" });
  });

  it("should report SECRET_INVALID when the secret is present but unusable, and the base URL is valid", () => {
    expect(
      resolveAutoProvisioningAvailability({
        ...validBaseUrlEnv,
        QAB_PROVISIONING_SECRET: "too-short",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ available: false, reason: "SECRET_INVALID" });
  });

  it("should report BASE_URL_NOT_SET when the secret is valid and the base URL is absent", () => {
    expect(
      resolveAutoProvisioningAvailability({
        QAB_PROVISIONING_SECRET: validSecret,
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ available: false, reason: "BASE_URL_NOT_SET" });
  });

  it("should report BASE_URL_INVALID when the secret is valid and the base URL does not parse", () => {
    expect(
      resolveAutoProvisioningAvailability({
        QAB_PROVISIONING_SECRET: validSecret,
        QAB_API_BASE_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ available: false, reason: "BASE_URL_INVALID" });
  });

  it("should report available: true, reason: null when both the secret and the base URL are valid", () => {
    expect(
      resolveAutoProvisioningAvailability({
        ...validBaseUrlEnv,
        QAB_PROVISIONING_SECRET: validSecret,
      } as unknown as NodeJS.ProcessEnv)
    ).toEqual({ available: true, reason: null });
  });

  // Precedence: when both variables are broken at once, the secret's reason wins — it is the
  // one that would actually fire first if the button were pressed (the route checks the
  // secret in its step 2, the base URL in its step 3). The contract fixes this by making the
  // DECLARATION ORDER of QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS the precedence order, so
  // this asserts against that array's indices rather than a copied literal — if the contract
  // ever reorders the array, this test tracks it instead of silently going stale.
  describe("precedence when both variables are broken at once", () => {
    const secretNotSetReason = QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS[0]; // "SECRET_NOT_SET"
    const secretInvalidReason = QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS[1]; // "SECRET_INVALID"

    it("secret absent + base URL absent -> reports the secret-absent reason", () => {
      expect(resolveAutoProvisioningAvailability({} as unknown as NodeJS.ProcessEnv)).toEqual({
        available: false,
        reason: secretNotSetReason,
      });
    });

    it("secret absent + base URL invalid -> STILL reports the secret-absent reason, not the URL's", () => {
      expect(
        resolveAutoProvisioningAvailability({
          QAB_API_BASE_URL: "not a url",
        } as unknown as NodeJS.ProcessEnv)
      ).toEqual({ available: false, reason: secretNotSetReason });
    });

    it("secret invalid + base URL absent -> reports the secret-invalid reason", () => {
      expect(
        resolveAutoProvisioningAvailability({
          QAB_PROVISIONING_SECRET: "too-short",
        } as unknown as NodeJS.ProcessEnv)
      ).toEqual({ available: false, reason: secretInvalidReason });
    });

    it("secret invalid + base URL invalid -> STILL reports the secret-invalid reason, not the URL's", () => {
      expect(
        resolveAutoProvisioningAvailability({
          QAB_PROVISIONING_SECRET: "too-short",
          QAB_API_BASE_URL: "not a url",
        } as unknown as NodeJS.ProcessEnv)
      ).toEqual({ available: false, reason: secretInvalidReason });
    });
  });
});
