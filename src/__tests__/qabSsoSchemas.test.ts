import { describe, it, expect } from "vitest";
import { qabSsoClaimsSchema, qabSsoDecodedTokenSchema } from "@/schemas/qabSso";

/**
 * F-009 — `src/schemas/qabSso.ts` (§ 2 of the contract). `qabSsoClaimsSchema` is `.strict()` on
 * purpose: acceptance criterion 5 ("the user's password never appears in the token") is
 * structural here, not something the emission code has to remember to enforce — a seventh key
 * (a password hash, say) simply cannot survive `.parse()`.
 */

const validClaims = {
  jti: "11111111-1111-4111-8111-111111111111",
  sub: "usr_1",
  name: "Ana Merchant",
  email: "ana@example.com",
  businessId: "biz_1",
  storeIds: ["store_1", "store_2"],
};

describe("qabSsoClaimsSchema", () => {
  it("should accept the six claims with plain string ids (no .uuid())", () => {
    // Ids and names are NOT required to be UUIDs (contract § 2): a legacy non-uuid id must not
    // turn into a validation 500 the moment a merchant presses the button.
    const result = qabSsoClaimsSchema.safeParse({
      ...validClaims,
      sub: "legacy-non-uuid-id",
      businessId: "legacy-non-uuid-business",
    });
    expect(result.success).toBe(true);
  });

  it("should accept an email-shaped 'usuario' value even though it is not validated as an email", () => {
    // email is min(1), NOT .email(): accounts created before EMAIL_REGEX existed may carry a
    // `usuario` that is not a well-formed address, and QAB publishes no format requirement.
    const result = qabSsoClaimsSchema.safeParse({ ...validClaims, email: "not-an-email-at-all" });
    expect(result.success).toBe(true);
  });

  it("should accept an empty storeIds array (a SUPER_ADMIN with no TIENDA locals)", () => {
    const result = qabSsoClaimsSchema.safeParse({ ...validClaims, storeIds: [] });
    expect(result.success).toBe(true);
  });

  it.each(["jti", "sub", "name", "email", "businessId", "storeIds"])(
    "should reject a payload missing '%s'",
    (missingKey) => {
      const incomplete: Record<string, unknown> = { ...validClaims };
      delete incomplete[missingKey];
      expect(qabSsoClaimsSchema.safeParse(incomplete).success).toBe(false);
    },
  );

  it.each(["jti", "sub", "name", "email", "businessId"])(
    "should reject an empty string for '%s'",
    (key) => {
      expect(qabSsoClaimsSchema.safeParse({ ...validClaims, [key]: "" }).success).toBe(false);
    },
  );

  it("should reject a storeIds array containing an empty string", () => {
    expect(qabSsoClaimsSchema.safeParse({ ...validClaims, storeIds: [""] }).success).toBe(false);
  });

  it("should reject a seventh key — this is what makes criterion 5 structural", () => {
    // A password hash riding along would have to arrive as an extra key. .strict() means it
    // can never survive parsing, regardless of what the emission code does or forgets to do.
    const withExtraKey = { ...validClaims, passwordHash: "not-supposed-to-be-here" };
    const result = qabSsoClaimsSchema.safeParse(withExtraKey);
    expect(result.success).toBe(false);
  });

  it("should reject a non-array storeIds", () => {
    expect(
      qabSsoClaimsSchema.safeParse({ ...validClaims, storeIds: "store_1" }).success,
    ).toBe(false);
  });
});

describe("qabSsoDecodedTokenSchema", () => {
  const decoded = { ...validClaims, iat: 1000, exp: 1060 };

  it("should accept the six claims plus iat and exp", () => {
    expect(qabSsoDecodedTokenSchema.safeParse(decoded).success).toBe(true);
  });

  it("should reject a decoded token missing iat", () => {
    const { iat: _iat, ...withoutIat } = decoded;
    expect(qabSsoDecodedTokenSchema.safeParse(withoutIat).success).toBe(false);
  });

  it("should reject a decoded token missing exp", () => {
    const { exp: _exp, ...withoutExp } = decoded;
    expect(qabSsoDecodedTokenSchema.safeParse(withoutExp).success).toBe(false);
  });

  it("should reject a non-integer exp", () => {
    expect(qabSsoDecodedTokenSchema.safeParse({ ...decoded, exp: 1060.5 }).success).toBe(false);
  });

  it("should reject an eighth key on the decoded schema too (.strict())", () => {
    expect(
      qabSsoDecodedTokenSchema.safeParse({ ...decoded, extra: "nope" }).success,
    ).toBe(false);
  });
});
