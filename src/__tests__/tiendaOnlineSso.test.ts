import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import type { Session } from "next-auth";
import { issueQabSsoLink } from "@/lib/tiendaOnline/tiendaOnlineSso";
import { TipoLocal } from "@/schemas/tienda";
import type { ILocal } from "@/schemas/tienda";
import { qabSsoDecodedTokenSchema } from "@/schemas/qabSso";
import { QAB_SSO_ADMIN_PATH, QAB_SSO_TOKEN_TTL_SECONDS } from "@/constants/qabSso";

/**
 * F-009 — `src/lib/tiendaOnline/tiendaOnlineSso.ts` (§ 6 of the contract). `issueQabSsoLink` is
 * the piece with the most coverage per test (§ 9.4 of the contract): synchronous, no I/O, and
 * it returns the CLOSED union this whole feature is built on. This is the one test file that can
 * decode a real, signed JWT end to end without a database or a network call — exactly what
 * criteria 1, 2, 4, 5, 9 and 10 ask for on their emitting half.
 */

const VALID_SECRET = "s".repeat(32);
const BASE_URL = "https://queandabuscando.example";
const VALID_ENV = { SSO_JWT_SECRET: VALID_SECRET, QAB_API_BASE_URL: BASE_URL } as unknown as NodeJS.ProcessEnv;
const BUSINESS_A = "business-a";
const BUSINESS_B = "business-b";

function local(overrides: Partial<ILocal>): ILocal {
  return {
    id: "local-default",
    nombre: "Local",
    negocioId: BUSINESS_A,
    tipo: TipoLocal.TIENDA,
    ...overrides,
  };
}

function negocio(id: string) {
  return {
    id,
    nombre: "Negocio",
    limitTime: new Date("2999-01-01"),
    locallimit: 10,
    userlimit: 10,
    productlimit: 10,
  };
}

function session(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "user-1",
      usuario: "merchant@example.com",
      nombre: "Ana Merchant",
      rol: "ADMIN",
      locales: [local({ id: "store-1" })],
      negocio: negocio(BUSINESS_A),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      ...overrides,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as unknown as Session;
}

function decodeIssuedUrl(url: string): { baseUrl: string; token: string } {
  const parsed = new URL(url);
  const token = parsed.searchParams.get("token");
  if (!token) throw new Error("test helper: issued url carried no token");
  return { baseUrl: `${parsed.protocol}//${parsed.host}`, token };
}

describe("issueQabSsoLink — environment unavailable (criterion 9)", () => {
  it("should return not_configured with reason SECRET_NOT_SET when the secret is absent", () => {
    const result = issueQabSsoLink({
      session: session(),
      env: { QAB_API_BASE_URL: BASE_URL } as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "SECRET_NOT_SET" });
  });

  it("should return not_configured with reason SECRET_INVALID when the secret is too short", () => {
    const result = issueQabSsoLink({
      session: session(),
      env: { SSO_JWT_SECRET: "short", QAB_API_BASE_URL: BASE_URL } as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "SECRET_INVALID" });
  });

  it("should return not_configured with reason BASE_URL_NOT_SET when the base URL is absent", () => {
    const result = issueQabSsoLink({
      session: session(),
      env: { SSO_JWT_SECRET: VALID_SECRET } as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "BASE_URL_NOT_SET" });
  });

  it("should return not_configured with reason BASE_URL_INVALID when the base URL does not parse", () => {
    const result = issueQabSsoLink({
      session: session(),
      env: {
        SSO_JWT_SECRET: VALID_SECRET,
        QAB_API_BASE_URL: "not a url",
      } as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "BASE_URL_INVALID" });
  });

  it("should check the environment BEFORE the session: a broken env wins even with no_identity session too", () => {
    // Discriminates the declared evaluation order (§ 6 of the contract): if the implementation
    // checked identity first, this call (blank session id AND no secret) would return
    // no_identity instead of not_configured.
    const brokenSession = session({ id: "" });
    const result = issueQabSsoLink({
      session: brokenSession,
      env: {} as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "SECRET_NOT_SET" });
  });
});

describe("issueQabSsoLink — no_identity", () => {
  it("should return no_identity for a null session, even with a valid environment", () => {
    expect(issueQabSsoLink({ session: null, env: VALID_ENV })).toEqual({ outcome: "no_identity" });
  });

  it("should return no_identity when session.user.nombre is blank, with a valid environment", () => {
    const result = issueQabSsoLink({ session: session({ nombre: "  " }), env: VALID_ENV });
    expect(result).toEqual({ outcome: "no_identity" });
  });

  it("should NOT return no_identity for an empty storeIds — that is a valid, empty identity", () => {
    const superAdminNoStores = session({ locales: [local({ tipo: TipoLocal.ALMACEN })] });
    const result = issueQabSsoLink({ session: superAdminNoStores, env: VALID_ENV });
    expect(result.outcome).toBe("issued");
  });
});

describe("issueQabSsoLink — issued (criteria 1, 2, 5)", () => {
  it("should return outcome 'issued' with a url under the resolved base URL and admin path", () => {
    const result = issueQabSsoLink({ session: session(), env: VALID_ENV });
    expect(result.outcome).toBe("issued");
    if (result.outcome !== "issued") throw new Error("unreachable");
    expect(result.url.startsWith(`${BASE_URL}${QAB_SSO_ADMIN_PATH}?`)).toBe(true);
  });

  it("should embed a token that verifies under SSO_JWT_SECRET and satisfies qabSsoDecodedTokenSchema", () => {
    const result = issueQabSsoLink({ session: session(), env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const { token } = decodeIssuedUrl(result.url);
    const decoded = jwt.verify(token, VALID_SECRET);
    expect(qabSsoDecodedTokenSchema.safeParse(decoded).success).toBe(true);
  });

  it("should carry the six claims with exp - iat === QAB_SSO_TOKEN_TTL_SECONDS (criterion 2)", () => {
    const s = session({
      id: "user-77",
      nombre: "Ana Merchant",
      usuario: "ana@example.com",
      negocio: negocio("business-77"),
      locales: [local({ id: "store-1", negocioId: "business-77", tipo: TipoLocal.TIENDA })],
    });
    const result = issueQabSsoLink({ session: s, env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const { token } = decodeIssuedUrl(result.url);
    const decoded = jwt.verify(token, VALID_SECRET) as jwt.JwtPayload;
    expect(decoded.sub).toBe("user-77");
    expect(decoded.name).toBe("Ana Merchant");
    expect(decoded.email).toBe("ana@example.com");
    expect(decoded.businessId).toBe("business-77");
    expect(decoded.storeIds).toEqual(["store-1"]);
    expect(decoded.exp! - decoded.iat!).toBe(QAB_SSO_TOKEN_TTL_SECONDS);
  });

  it("should never place a password-shaped claim in the token (criterion 5)", () => {
    const result = issueQabSsoLink({ session: session(), env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const { token } = decodeIssuedUrl(result.url);
    const decoded = jwt.verify(token, VALID_SECRET) as Record<string, unknown>;
    expect(decoded).not.toHaveProperty("password");
    expect(decoded).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(decoded)).not.toMatch(/password/i);
  });

  it("should mint a DIFFERENT jti on every call, even for the identical session and environment (criterion 10)", () => {
    const s = session();
    const first = issueQabSsoLink({ session: s, env: VALID_ENV });
    const second = issueQabSsoLink({ session: s, env: VALID_ENV });
    if (first.outcome !== "issued" || second.outcome !== "issued") {
      throw new Error("expected both calls to be issued");
    }
    const firstJti = (jwt.verify(decodeIssuedUrl(first.url).token, VALID_SECRET) as jwt.JwtPayload).jti;
    const secondJti = (jwt.verify(decodeIssuedUrl(second.url).token, VALID_SECRET) as jwt.JwtPayload).jti;
    expect(firstJti).toBeDefined();
    expect(firstJti).not.toBe(secondJti);
  });

  it("should scope storeIds to a single store for a user assigned to 1 of 3 (criterion 4)", () => {
    const s = session({ locales: [local({ id: "store-only-one", tipo: TipoLocal.TIENDA })] });
    const result = issueQabSsoLink({ session: s, env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const decoded = jwt.verify(decodeIssuedUrl(result.url).token, VALID_SECRET) as jwt.JwtPayload;
    expect(decoded.storeIds).toEqual(["store-only-one"]);
  });

  it("should scope storeIds to all three stores for a SUPER_ADMIN with access to 3 (criterion 4)", () => {
    const s = session({
      locales: [
        local({ id: "store-1", tipo: TipoLocal.TIENDA }),
        local({ id: "store-2", tipo: TipoLocal.TIENDA }),
        local({ id: "store-3", tipo: TipoLocal.TIENDA }),
      ],
    });
    const result = issueQabSsoLink({ session: s, env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const decoded = jwt.verify(decodeIssuedUrl(result.url).token, VALID_SECRET) as jwt.JwtPayload;
    expect(decoded.storeIds).toEqual(["store-1", "store-2", "store-3"]);
  });

  it("should never include a store of a different business (criterion 7, multi-tenant)", () => {
    const s = session({
      negocio: negocio(BUSINESS_A),
      locales: [
        local({ id: "store-own", negocioId: BUSINESS_A, tipo: TipoLocal.TIENDA }),
        local({ id: "store-foreign", negocioId: BUSINESS_B, tipo: TipoLocal.TIENDA }),
      ],
    });
    const result = issueQabSsoLink({ session: s, env: VALID_ENV });
    if (result.outcome !== "issued") throw new Error("expected issued");
    const decoded = jwt.verify(decodeIssuedUrl(result.url).token, VALID_SECRET) as jwt.JwtPayload;
    expect(decoded.storeIds).toEqual(["store-own"]);
  });
});

describe("issueQabSsoLink — is synchronous with no I/O", () => {
  it("should return a plain value, never a Promise or thenable", () => {
    const result = issueQabSsoLink({ session: session(), env: VALID_ENV });
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof (result as unknown as { then?: unknown }).then).not.toBe("function");
  });
});
