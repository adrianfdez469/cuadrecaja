import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { signQabSsoToken, QabSsoSigningError } from "@/lib/qab/qabSsoToken";
import { QAB_SSO_ALGORITHM, QAB_SSO_SIGNING_FAILED, QAB_SSO_TOKEN_TTL_SECONDS } from "@/constants/qabSso";
import { qabSsoDecodedTokenSchema } from "@/schemas/qabSso";
import type { IQabSsoClaims } from "@/schemas/qabSso";

/**
 * F-009 — `src/lib/qab/qabSsoToken.ts` (§ 5 of the contract, ADR 0068). The ONLY consumer of
 * the secret in this suite's reach, and the module the E-031 regression test targets directly:
 * criterion 9 says the secret never leaks through an error message, and its sibling here is that
 * a claim's own value never leaks through one either (the ZodError issues array is discarded).
 */

const validSecret = "s".repeat(32);
const validClaims: IQabSsoClaims = {
  jti: "11111111-1111-4111-8111-111111111111",
  sub: "user-1",
  name: "Ana Merchant",
  email: "ana@example.com",
  businessId: "business-1",
  storeIds: ["store-1", "store-2"],
};

describe("signQabSsoToken — happy path", () => {
  it("should produce a token that verifies against the SAME secret with HS256", () => {
    const token = signQabSsoToken(validClaims, validSecret);
    const decoded = jwt.verify(token, validSecret, { algorithms: ["HS256"] });
    expect(decoded).toMatchObject(validClaims);
  });

  it("should reject verification under a DIFFERENT secret — proves it actually signed with the one given", () => {
    const token = signQabSsoToken(validClaims, validSecret);
    expect(() => jwt.verify(token, "t".repeat(32), { algorithms: ["HS256"] })).toThrow();
  });

  it("should sign with the pinned HS256 algorithm, never anything else", () => {
    const token = signQabSsoToken(validClaims, validSecret);
    const header = jwt.decode(token, { complete: true })?.header;
    expect(header?.alg).toBe(QAB_SSO_ALGORITHM);
  });

  it("should set exp - iat to EXACTLY QAB_SSO_TOKEN_TTL_SECONDS", () => {
    const token = signQabSsoToken(validClaims, validSecret);
    const decoded = jwt.verify(token, validSecret) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(QAB_SSO_TOKEN_TTL_SECONDS);
  });

  it("should produce a payload that satisfies qabSsoDecodedTokenSchema exactly (no stray key)", () => {
    const token = signQabSsoToken(validClaims, validSecret);
    const decoded = jwt.verify(token, validSecret);
    const result = qabSsoDecodedTokenSchema.safeParse(decoded);
    expect(result.success).toBe(true);
  });

  it("should carry jti in the payload, verifiable without any options collision error", () => {
    // jsonwebtoken throws if a claim is given in BOTH options and payload. This test simply
    // confirms signing with a jti-bearing payload never raises that collision — if the
    // implementation moved jti into options as well, this call itself would throw.
    expect(() => signQabSsoToken(validClaims, validSecret)).not.toThrow();
  });

  it("should give each call a token whose jti matches the claims passed to IT, not a shared one", () => {
    const firstClaims = { ...validClaims, jti: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    const secondClaims = { ...validClaims, jti: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    const firstDecoded = jwt.verify(signQabSsoToken(firstClaims, validSecret), validSecret) as jwt.JwtPayload;
    const secondDecoded = jwt.verify(signQabSsoToken(secondClaims, validSecret), validSecret) as jwt.JwtPayload;
    expect(firstDecoded.jti).toBe(firstClaims.jti);
    expect(secondDecoded.jti).toBe(secondClaims.jti);
    expect(firstDecoded.jti).not.toBe(secondDecoded.jti);
  });
});

describe("signQabSsoToken — failure is always QabSsoSigningError with the fixed message (E-031)", () => {
  it("should throw QabSsoSigningError, and ONLY the fixed message, when the claims fail their own schema", () => {
    const invalidClaims = { ...validClaims, storeIds: "not-an-array" } as unknown as IQabSsoClaims;
    expect(() => signQabSsoToken(invalidClaims, validSecret)).toThrow(QabSsoSigningError);
    try {
      signQabSsoToken(invalidClaims, validSecret);
      expect.fail("expected signQabSsoToken to throw");
    } catch (error) {
      expect((error as Error).message).toBe(QAB_SSO_SIGNING_FAILED);
    }
  });

  it("should NEVER leak an invalid claim's own value through the thrown message — the ZodError issues are discarded", () => {
    const poisonedClaims = {
      ...validClaims,
      email: "SHOULD_NEVER_LEAK_THIS_VALUE",
      storeIds: 12345, // wrong type: forces a ZodError whose issues cite this payload
    } as unknown as IQabSsoClaims;
    try {
      signQabSsoToken(poisonedClaims, validSecret);
      expect.fail("expected signQabSsoToken to throw");
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toBe(QAB_SSO_SIGNING_FAILED);
      expect(message).not.toContain("SHOULD_NEVER_LEAK_THIS_VALUE");
      expect(message).not.toContain("12345");
    }
  });

  it("should NEVER chain the schema failure as `cause`", () => {
    const invalidClaims = { ...validClaims, jti: "" } as unknown as IQabSsoClaims;
    try {
      signQabSsoToken(invalidClaims, validSecret);
      expect.fail("expected signQabSsoToken to throw");
    } catch (error) {
      expect((error as Error).cause).toBeUndefined();
    }
  });

  it("should replace ANY value thrown from inside jwt.sign itself with QabSsoSigningError", () => {
    // An unusable secret (not a string) makes jsonwebtoken's own call throw. This exercises the
    // try/catch around step 2, independent of the schema check in step 1.
    const unusableSecret = null as unknown as string;
    try {
      signQabSsoToken(validClaims, unusableSecret);
      expect.fail("expected signQabSsoToken to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabSsoSigningError);
      expect((error as Error).message).toBe(QAB_SSO_SIGNING_FAILED);
      expect((error as Error).cause).toBeUndefined();
    }
  });
});
