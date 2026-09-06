import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import {
  selectQabSsoStoreIds,
  buildQabSsoClaims,
  isQabSsoIssuableEmail,
} from "@/lib/qab/qabSsoClaims";
import { TipoLocal } from "@/schemas/tienda";
import type { ILocal } from "@/schemas/tienda";
import { EMAIL_REGEX } from "@/constants/validation";

/**
 * F-009 — `src/lib/qab/qabSsoClaims.ts` (§ 4 of the contract, ADR 0067). Both functions are
 * pure and take no database access: `buildQabSsoClaims` reads only `session.user`, and
 * `selectQabSsoStoreIds` only filters an in-memory list.
 */

const BUSINESS_A = "biz-a";
const BUSINESS_B = "biz-b";

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

describe("selectQabSsoStoreIds", () => {
  it("should include a TIENDA of the given business", () => {
    const locales = [local({ id: "store-1", negocioId: BUSINESS_A, tipo: TipoLocal.TIENDA })];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1"]);
  });

  it("should NEVER include an ALMACEN, even of the correct business (ADR 0067)", () => {
    const locales = [
      local({ id: "store-1", negocioId: BUSINESS_A, tipo: TipoLocal.TIENDA }),
      local({ id: "warehouse-1", negocioId: BUSINESS_A, tipo: TipoLocal.ALMACEN }),
    ];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1"]);
  });

  it("should NEVER include a local of a different business, even with a guessable/sequential id (criterion 7)", () => {
    const locales = [
      local({ id: "store-1", negocioId: BUSINESS_A, tipo: TipoLocal.TIENDA }),
      local({ id: "store-2", negocioId: BUSINESS_B, tipo: TipoLocal.TIENDA }),
    ];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1"]);
  });

  it("should apply BOTH conditions together: a foreign ALMACEN passes neither", () => {
    const locales = [local({ id: "foreign-warehouse", negocioId: BUSINESS_B, tipo: TipoLocal.ALMACEN })];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual([]);
  });

  it("should return [] for a null list", () => {
    expect(selectQabSsoStoreIds(null, BUSINESS_A)).toEqual([]);
  });

  it("should return [] for an undefined list", () => {
    expect(selectQabSsoStoreIds(undefined, BUSINESS_A)).toEqual([]);
  });

  it("should return [] when the user has no TIENDA at all (e.g. only an ALMACEN)", () => {
    const locales = [local({ id: "warehouse-only", tipo: TipoLocal.ALMACEN })];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual([]);
  });

  it("should return one id for a user assigned to 1 of 3 TIENDA locals (criterion 4)", () => {
    // Simulates a UsuarioTienda user restricted to a single store: authOptions already scoped
    // `locales` down to that one store before this function ever runs.
    const locales = [local({ id: "store-1", tipo: TipoLocal.TIENDA })];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1"]);
  });

  it("should return all three ids for a SUPER_ADMIN with access to 3 TIENDA locals (criterion 4)", () => {
    const locales = [
      local({ id: "store-1", tipo: TipoLocal.TIENDA }),
      local({ id: "store-2", tipo: TipoLocal.TIENDA }),
      local({ id: "store-3", tipo: TipoLocal.TIENDA }),
    ];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1", "store-2", "store-3"]);
  });

  it("should preserve order of appearance", () => {
    const locales = [
      local({ id: "store-c", tipo: TipoLocal.TIENDA }),
      local({ id: "store-a", tipo: TipoLocal.TIENDA }),
      local({ id: "store-b", tipo: TipoLocal.TIENDA }),
    ];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-c", "store-a", "store-b"]);
  });

  it("should drop duplicates, keeping the FIRST occurrence", () => {
    const locales = [
      local({ id: "store-1", tipo: TipoLocal.TIENDA }),
      local({ id: "store-1", tipo: TipoLocal.TIENDA }),
    ];
    expect(selectQabSsoStoreIds(locales, BUSINESS_A)).toEqual(["store-1"]);
  });
});

describe("buildQabSsoClaims", () => {
  it("should return null for a null session", () => {
    expect(buildQabSsoClaims({ session: null, jti: "jti-1" })).toBeNull();
  });

  it("should return null when session.user.id is blank after trimming", () => {
    expect(buildQabSsoClaims({ session: session({ id: "   " }), jti: "jti-1" })).toBeNull();
  });

  it("should return null when session.user.nombre is blank after trimming", () => {
    expect(buildQabSsoClaims({ session: session({ nombre: "" }), jti: "jti-1" })).toBeNull();
  });

  it("should return null when session.user.usuario is blank after trimming", () => {
    expect(buildQabSsoClaims({ session: session({ usuario: "  " }), jti: "jti-1" })).toBeNull();
  });

  it("should return null when session.user.negocio.id is blank after trimming", () => {
    const withBlankBusinessId = session({ negocio: negocio("  ") });
    expect(buildQabSsoClaims({ session: withBlankBusinessId, jti: "jti-1" })).toBeNull();
  });

  it("should NOT return null for an empty storeIds — an empty list is a valid identity, not an error", () => {
    const withNoTiendas = session({ locales: [local({ tipo: TipoLocal.ALMACEN })] });
    const claims = buildQabSsoClaims({ session: withNoTiendas, jti: "jti-1" });
    expect(claims).not.toBeNull();
    expect(claims?.storeIds).toEqual([]);
  });

  it("should read email from session.user.usuario, NOT from a next-auth 'email' field (ADR 0067)", () => {
    // The Usuario model has no email column: `usuario` holds the address. A next-auth default
    // session type carries an optional `email`, so this plants a DIFFERENT value there to prove
    // the claim is not accidentally sourced from it (E-008: the two branches must diverge).
    const withDivergentEmailField = session({
      usuario: "real-address@example.com",
      // `email` is next-auth's own DefaultSession["user"] field, deliberately given a
      // DIFFERENT value than `usuario` so the two branches discriminate (E-008).
      email: "wrong-source@example.com",
    });
    const claims = buildQabSsoClaims({ session: withDivergentEmailField, jti: "jti-1" });
    expect(claims?.email).toBe("real-address@example.com");
  });

  it("should map all six claims to their exact contractual source", () => {
    const s = session({
      id: "user-42",
      nombre: "Ana Merchant",
      usuario: "ana@example.com",
      locales: [local({ id: "store-1", negocioId: "business-42", tipo: TipoLocal.TIENDA })],
      negocio: negocio("business-42"),
    });
    const claims = buildQabSsoClaims({ session: s, jti: "the-jti" });
    expect(claims).toEqual({
      jti: "the-jti",
      sub: "user-42",
      name: "Ana Merchant",
      email: "ana@example.com",
      businessId: "business-42",
      storeIds: ["store-1"],
    });
  });

  it("should trim the four string fields and carry the TRIMMED value", () => {
    const s = session({
      id: "  user-1  ",
      nombre: "  Ana  ",
      usuario: "  ana@example.com  ",
      negocio: negocio("  business-1  "),
    });
    const claims = buildQabSsoClaims({ session: s, jti: "jti-1" });
    expect(claims?.sub).toBe("user-1");
    expect(claims?.name).toBe("Ana");
    expect(claims?.email).toBe("ana@example.com");
    expect(claims?.businessId).toBe("business-1");
  });

  it("should use the jti argument verbatim, not derive one of its own", () => {
    const claims = buildQabSsoClaims({ session: session(), jti: "caller-supplied-jti" });
    expect(claims?.jti).toBe("caller-supplied-jti");
  });

  it("should scope storeIds to the session's own business, excluding a foreign store (criterion 7)", () => {
    const s = session({
      negocio: negocio(BUSINESS_A),
      locales: [
        local({ id: "store-a", negocioId: BUSINESS_A, tipo: TipoLocal.TIENDA }),
        local({ id: "store-b", negocioId: BUSINESS_B, tipo: TipoLocal.TIENDA }),
      ],
    });
    const claims = buildQabSsoClaims({ session: s, jti: "jti-1" });
    expect(claims?.storeIds).toEqual(["store-a"]);
  });
});

/**
 * F-023 — `isQabSsoIssuableEmail`, added to this file per § 1.2 of the contract. Four DISTINCT
 * `it`s for criterion 6, not a combined case and not an `it.each` (§ 8.1 of the contract,
 * E-019): a valid email, a string with no @, a string with @ and no dot after it, and an empty
 * string.
 *
 * This describe block asserts ONLY the pure function's own level. It deliberately does NOT
 * assert anything about `issueQabSsoLink`'s outcome for a blank `usuario` — that belongs to
 * `tiendaOnlineSso.test.ts`. Mixing the two levels here is exactly the shape of E-030: this
 * function returns `false` for `""`, and yet a session whose `usuario` is `""` still resolves
 * to `no_identity`, never `user_not_email` (§ 3.1 of the contract, ADR 0086).
 */
describe("isQabSsoIssuableEmail", () => {
  it("should return true for a valid email (criterion 6)", () => {
    expect(isQabSsoIssuableEmail("merchant@example.com")).toBe(true);
  });

  it("should return false for a string with no @ (criterion 6)", () => {
    expect(isQabSsoIssuableEmail("admin")).toBe(false);
  });

  it("should return false for a string with @ and no dot after it (criterion 6)", () => {
    expect(isQabSsoIssuableEmail("admin@localhost")).toBe(false);
  });

  it("should return false for an empty string — pure-function level ONLY, see the outcome-level distinction in tiendaOnlineSso.test.ts (criterion 6, § 3.1, E-030)", () => {
    expect(isQabSsoIssuableEmail("")).toBe(false);
  });

  it("should return false for null", () => {
    expect(isQabSsoIssuableEmail(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isQabSsoIssuableEmail(undefined)).toBe(false);
  });

  it("should return false for a string that is blank only after trimming (whitespace-only)", () => {
    expect(isQabSsoIssuableEmail("   ")).toBe(false);
  });

  it("should trim surrounding whitespace before judging — a padded valid address is issuable", () => {
    expect(isQabSsoIssuableEmail("  merchant@example.com  ")).toBe(true);
  });

  it("should reject a string with no local part before the @", () => {
    expect(isQabSsoIssuableEmail("@example.com")).toBe(false);
  });

  it("should agree with EMAIL_REGEX evaluated on the trimmed value — the SSO gate and the account gates share ONE rule (ADR 0087)", () => {
    const cases = [
      "merchant@example.com",
      "admin",
      "admin@localhost",
      "@example.com",
      "  spaced@example.com  ",
      "   ",
    ];
    for (const value of cases) {
      expect(isQabSsoIssuableEmail(value)).toBe(EMAIL_REGEX.test(value.trim()));
    }
  });
});
