import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import type { Session } from "next-auth";
import { issueQabSsoLink } from "@/lib/tiendaOnline/tiendaOnlineSso";
import type { ITiendaOnlineSsoOutcome } from "@/lib/tiendaOnline/tiendaOnlineSso";
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

/**
 * F-023 — the fourth outcome (§ 1.3, § 3.2 of the contract, ADR 0086). `isQabSsoIssuableEmail`
 * is evaluated on `claims.email`, so these sessions all carry a `usuario` with SOME non-blank
 * value that simply does not have address shape — the table of § 3.2 has the exact examples
 * used below.
 */
describe("issueQabSsoLink — user_not_email (criteria 1, 3, 4)", () => {
  it("should return user_not_email when usuario has no @ (e.g. the seed's admin)", () => {
    const result = issueQabSsoLink({ session: session({ usuario: "admin" }), env: VALID_ENV });
    expect(result).toEqual({ outcome: "user_not_email", sub: "user-1" });
  });

  it("should return user_not_email when usuario has an @ but no dot after it", () => {
    const result = issueQabSsoLink({
      session: session({ usuario: "admin@localhost" }),
      env: VALID_ENV,
    });
    expect(result).toEqual({ outcome: "user_not_email", sub: "user-1" });
  });

  it("should return user_not_email when usuario has no local part before the @", () => {
    const result = issueQabSsoLink({
      session: session({ usuario: "@ejemplo.com" }),
      env: VALID_ENV,
    });
    expect(result).toEqual({ outcome: "user_not_email", sub: "user-1" });
  });

  it("should still return user_not_email for a padded malformed usuario — trimming does not turn it into an email", () => {
    const result = issueQabSsoLink({ session: session({ usuario: "   admin   " }), env: VALID_ENV });
    expect(result.outcome).toBe("user_not_email");
  });

  it("should return issued, unaffected, when usuario IS a valid email padded with whitespace (regression, criterion 3)", () => {
    const result = issueQabSsoLink({
      session: session({ usuario: "  merchant@example.com  " }),
      env: VALID_ENV,
    });
    expect(result.outcome).toBe("issued");
  });

  it("should carry sub as claims.sub, the trimmed internal id — and NOTHING else: no usuario, no email, no url, no reason (criterion 5, E-031, structural)", () => {
    const result = issueQabSsoLink({
      session: session({ id: "  user-99  ", usuario: "not-an-email" }),
      env: VALID_ENV,
    });
    expect(result.outcome).toBe("user_not_email");
    expect(Object.keys(result).sort()).toEqual(["outcome", "sub"]);
    if (result.outcome !== "user_not_email") throw new Error("unreachable");
    expect(result.sub).toBe("user-99");
    // The rejected `usuario` must not leak anywhere in the returned value.
    expect(JSON.stringify(result)).not.toMatch(/not-an-email/);
  });

  it("should return not_configured (not user_not_email) when the environment is broken even though usuario also has no email shape — step 1 still wins", () => {
    const result = issueQabSsoLink({
      session: session({ usuario: "admin" }),
      env: {} as unknown as NodeJS.ProcessEnv,
    });
    expect(result).toEqual({ outcome: "not_configured", reason: "SECRET_NOT_SET" });
  });
});

/**
 * F-023 — the precedence trap the contract repeats three times on purpose (§ 3.1, ADR 0086,
 * E-030). `isQabSsoIssuableEmail("")` is `false` (see qabSsoClaims.test.ts), but a blank
 * `usuario` never reaches step 3b: `buildQabSsoClaims` already rejects it at step 3, so the
 * OUTCOME stays `no_identity`. These two facts are true at once and at different levels;
 * asserting `user_not_email` here would be testing something this contract does not say,
 * against a correct implementation.
 */
describe("issueQabSsoLink — no_identity takes precedence over user_not_email (§ 3.1, ADR 0086, E-030)", () => {
  it("should return no_identity, NOT user_not_email, for an empty usuario", () => {
    const result = issueQabSsoLink({ session: session({ usuario: "" }), env: VALID_ENV });
    expect(result).toEqual({ outcome: "no_identity" });
  });

  it("should return no_identity, NOT user_not_email, for a whitespace-only usuario", () => {
    const result = issueQabSsoLink({ session: session({ usuario: "   " }), env: VALID_ENV });
    expect(result).toEqual({ outcome: "no_identity" });
  });

  it("should return no_identity, NOT user_not_email, when usuario is absent from the session altogether", () => {
    const result = issueQabSsoLink({ session: session({ usuario: undefined }), env: VALID_ENV });
    expect(result).toEqual({ outcome: "no_identity" });
  });

  it("should return no_identity (not user_not_email) when nombre is blank even though usuario ALSO has no email shape", () => {
    const result = issueQabSsoLink({
      session: session({ nombre: "", usuario: "admin" }),
      env: VALID_ENV,
    });
    expect(result).toEqual({ outcome: "no_identity" });
  });
});

/**
 * F-023 — the union grows a fourth member (§ 1.3 of the contract). This only fails
 * `npx tsc --noEmit` if the union has fewer than four members or a different one: the runtime
 * assertion below is secondary to the compile-time exhaustiveness check (E-026 — a green
 * `npm test` does not imply a clean `tsc`).
 */
describe("ITiendaOnlineSsoOutcome — the closed union has exactly four members", () => {
  it("should let an exhaustive switch over `outcome` cover issued, not_configured, no_identity and user_not_email with no `default`", () => {
    function describeOutcome(o: ITiendaOnlineSsoOutcome): string {
      switch (o.outcome) {
        case "issued":
          return o.url;
        case "not_configured":
          return o.reason;
        case "no_identity":
          return "no_identity";
        case "user_not_email":
          return o.sub;
        default: {
          const exhaustive: never = o;
          throw new Error(`unreachable outcome: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
    expect(describeOutcome({ outcome: "no_identity" })).toBe("no_identity");
    expect(describeOutcome({ outcome: "user_not_email", sub: "user-1" })).toBe("user-1");
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
