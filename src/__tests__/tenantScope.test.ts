import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";

/**
 * F-021 — `src/lib/tenantScope.ts` (contract § 2, ADR 0076/0077).
 *
 * This file covers ONLY the pure/synchronous surface named by contract § 9.2:
 * `sessionNegocioId`, `tiendaTenantWhere`, `withTenantScope`, `decideTenantScope`,
 * `tenantForbiddenResponse`, `tenantNotFoundResponse`, `tenantScopeDenial` and
 * `resolveTenantAxis`. `assertTiendaTenant` reads `Tienda` from Prisma and is
 * explicitly OUT of the suite's scope (§ 9.2, same reasoning as
 * `resolveTiendaOnlineOrderScope` in F-011): it is verified by EXECUTING — the `qa`'s
 * curl of criteria 2, 3 and 9 against two real negocios — not by a unit test here.
 *
 * `@/lib/prisma` is mocked defensively: `tenantScope.ts` imports the singleton at
 * module top level (for `assertTiendaTenant`) even though nothing in this file calls it.
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const {
  sessionNegocioId,
  tiendaTenantWhere,
  withTenantScope,
  decideTenantScope,
  TENANT_SCOPE_DECISIONS,
  tenantForbiddenResponse,
  tenantNotFoundResponse,
  tenantScopeDenial,
  resolveTenantAxis,
} = await import("@/lib/tenantScope");

const { TENANT_SCOPE_API_ERRORS, TENANT_RELATION_PATH } = await import(
  "@/constants/tenantScope"
);

const NEGOCIO_A = "negocio-a-uuid";

const sesion = (
  over: { negocioId?: string; permisos?: string; rol?: string } = {},
): Session =>
  ({
    user: {
      id: "user-1",
      negocio: over.negocioId ? { id: over.negocioId } : undefined,
      permisos: over.permisos ?? "",
      rol: over.rol ?? "VENDEDOR",
    },
  }) as unknown as Session;

describe("sessionNegocioId", () => {
  it("returns session.user.negocio.id when present", () => {
    expect(sessionNegocioId(sesion({ negocioId: NEGOCIO_A }))).toBe(NEGOCIO_A);
  });

  it("returns null with no session at all", () => {
    expect(sessionNegocioId(null)).toBeNull();
  });

  it("returns null when the session carries no negocio", () => {
    expect(sessionNegocioId(sesion({}))).toBeNull();
  });
});

describe("tiendaTenantWhere", () => {
  it("ties a Tienda to its negocio with exactly `id` and `negocioId`, nothing else", () => {
    expect(tiendaTenantWhere({ tiendaId: "t1", negocioId: NEGOCIO_A })).toEqual({
      id: "t1",
      negocioId: NEGOCIO_A,
    });
  });
});

describe("withTenantScope", () => {
  it("adds negocioId directly on the model for an empty relation path (`tienda`)", () => {
    // Contract § 2's own worked example.
    expect(withTenantScope("tienda", { id: "t1" }, NEGOCIO_A)).toEqual({
      id: "t1",
      negocioId: NEGOCIO_A,
    });
  });

  it("nests one hop for a model whose relation path has one segment (`transferDestinations`)", () => {
    // Contract § 2's own worked example.
    expect(
      withTenantScope("transferDestinations", { tiendaId: "t1" }, NEGOCIO_A),
    ).toEqual({
      tiendaId: "t1",
      tienda: { negocioId: NEGOCIO_A },
    });
  });

  it("nests two hops for a model whose relation path has two segments (`cashBreakdownCierre`)", () => {
    // Contract § 2's own worked example.
    expect(
      withTenantScope("cashBreakdownCierre", { cierrePeriodoId: "c1" }, NEGOCIO_A),
    ).toEqual({
      cierrePeriodoId: "c1",
      cierrePeriodo: { tienda: { negocioId: NEGOCIO_A } },
    });
  });

  it("nests two hops through the model's own relation field name, not a generic one (`productoProveedorLiquidacion` -> `cierre`, not `cierrePeriodo`)", () => {
    expect(
      withTenantScope(
        "productoProveedorLiquidacion",
        { cierreId: "c1", proveedorId: "p1" },
        NEGOCIO_A,
      ),
    ).toEqual({
      cierreId: "c1",
      proveedorId: "p1",
      cierre: { tienda: { negocioId: NEGOCIO_A } },
    });
  });

  it("deep-merges instead of overwriting when `where` already touches the first relation segment", () => {
    const result = withTenantScope(
      "transferDestinations",
      { tienda: { id: "t1" } },
      NEGOCIO_A,
    );
    expect(result).toEqual({ tienda: { id: "t1", negocioId: NEGOCIO_A } });
  });

  it("the tenant clause always wins over a colliding negocioId already present in `where`", () => {
    // Nobody outside this module can loosen the clause by pre-seeding it — that is
    // the whole point of folding it in here instead of trusting a caller's own where.
    const result = withTenantScope(
      "transferDestinations",
      { tienda: { negocioId: "attacker-supplied" } },
      NEGOCIO_A,
    );
    expect(result).toEqual({ tienda: { negocioId: NEGOCIO_A } });
  });

  it("does NOT mutate the `where` object it receives", () => {
    const original = { tiendaId: "t1" };
    const originalSnapshot = { ...original };
    withTenantScope("transferDestinations", original, NEGOCIO_A);
    expect(original).toEqual(originalSnapshot);
  });

  /**
   * F-029, contract § 6.1 and criterion 11 — the three new entries verbatim from the
   * contract's own worked examples. `Cliente` carries `negocioId` directly (mirrors
   * `tienda`); `CuentaPorCobrar` reaches it through its own direct `Tienda` edge, ONE
   * hop; `MovimientoCuentaPorCobrar` reaches it through `cuentaPorCobrar -> tienda`,
   * TWO hops. Without the three matching entries in `TENANT_RELATION_PATH`, `tsc`
   * itself refuses to compile this call (contract § 6.1) — that is the safety net
   * criterion 11 exists to keep in place.
   */
  it("adds negocioId directly on the model for Cliente, which carries the column directly (F-029)", () => {
    expect(withTenantScope("cliente", { id: "cl1" }, NEGOCIO_A)).toEqual({
      id: "cl1",
      negocioId: NEGOCIO_A,
    });
  });

  it("nests ONE hop for CuentaPorCobrar, through its own direct Tienda edge (F-029)", () => {
    expect(withTenantScope("cuentaPorCobrar", { id: "cxc1" }, NEGOCIO_A)).toEqual({
      id: "cxc1",
      tienda: { negocioId: NEGOCIO_A },
    });
  });

  it("nests TWO hops for MovimientoCuentaPorCobrar, through cuentaPorCobrar -> tienda (F-029)", () => {
    expect(
      withTenantScope("movimientoCuentaPorCobrar", { id: "m1" }, NEGOCIO_A),
    ).toEqual({
      id: "m1",
      cuentaPorCobrar: { tienda: { negocioId: NEGOCIO_A } },
    });
  });
});

describe("TENANT_RELATION_PATH — the three F-029 entries (contract § 6.1)", () => {
  it("declares cliente with an empty path (negocioId directly on the model)", () => {
    expect(TENANT_RELATION_PATH.cliente).toEqual([]);
  });

  it("declares cuentaPorCobrar as a one-hop path through its own `tienda` relation field", () => {
    expect(TENANT_RELATION_PATH.cuentaPorCobrar).toEqual(["tienda"]);
  });

  it("declares movimientoCuentaPorCobrar as a two-hop path through `cuentaPorCobrar`, matching the Prisma relation field name (not a generic `cuenta`)", () => {
    expect(TENANT_RELATION_PATH.movimientoCuentaPorCobrar).toEqual([
      "cuentaPorCobrar",
      "tienda",
    ]);
  });
});

describe("decideTenantScope", () => {
  it("all four documented decisions are exactly TENANT_SCOPE_DECISIONS, nothing more", () => {
    expect(TENANT_SCOPE_DECISIONS).toEqual([
      "ALLOWED",
      "NO_SESSION",
      "MISSING_PERMISSION",
      "OUT_OF_TENANT",
    ]);
  });

  it("NO_SESSION when there is no session negocioId, regardless of permission or ownership", () => {
    expect(
      decideTenantScope({ session: null, permisoRequerido: null, ownsResource: true }),
    ).toBe("NO_SESSION");
    expect(
      decideTenantScope({
        session: null,
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: false,
      }),
    ).toBe("NO_SESSION");
  });

  it("ALLOWED when no permission is required and the resource is owned", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A }),
        permisoRequerido: null,
        ownsResource: true,
      }),
    ).toBe("ALLOWED");
  });

  it("OUT_OF_TENANT when no permission is required but the resource is NOT owned", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A }),
        permisoRequerido: null,
        ownsResource: false,
      }),
    ).toBe("OUT_OF_TENANT");
  });

  it("MISSING_PERMISSION when the permission is required and absent, even though the resource IS owned", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, permisos: "" }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("THE ORDER IS THE CONTRACT: missing permission + out-of-tenant resource is MISSING_PERMISSION, never OUT_OF_TENANT", () => {
    // Contract § 2: permission is pure and checked first; ownership costs a query and
    // is only reached once permission clears. A denial-by-permission must not leak
    // whether the resource would also have been out of tenant.
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, permisos: "" }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: false,
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("ALLOWED when the permission is present and the resource is owned", () => {
    expect(
      decideTenantScope({
        session: sesion({
          negocioId: NEGOCIO_A,
          permisos: "configuracion.locales.acceder",
        }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
      }),
    ).toBe("ALLOWED");
  });

  it("SUPER_ADMIN is NOT exempt from the tenant axis: OUT_OF_TENANT still applies when the resource is not owned", () => {
    // ADR 0076 principle 5: SUPER_ADMIN is compared against its OWN session's negocio,
    // exactly like every other role — `verificarPermisoUsuario` grants it the
    // permission for free, but ownership is untouched by role.
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, rol: "SUPER_ADMIN", permisos: "" }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: false,
      }),
    ).toBe("OUT_OF_TENANT");
  });
});

describe("tenantForbiddenResponse", () => {
  it("responds 403 with the module's single forbidden body", async () => {
    const res = tenantForbiddenResponse();
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: TENANT_SCOPE_API_ERRORS.forbidden,
    });
  });

  it("is never a 401 or a 404 — the middleware owns 401, tenantNotFoundResponse owns 404", () => {
    const res = tenantForbiddenResponse();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(404);
  });
});

describe("tenantNotFoundResponse", () => {
  it("responds 404 with the module's single not-found body", async () => {
    const res = tenantNotFoundResponse();
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: TENANT_SCOPE_API_ERRORS.notFound,
    });
  });

  it("is never a 401 or a 403 — 'does not exist' and 'belongs to another negocio' answer identically (ADR 0077, no existence oracle)", () => {
    const res = tenantNotFoundResponse();
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("tenantScopeDenial", () => {
  it("returns null for ALLOWED, so the caller proceeds", () => {
    expect(tenantScopeDenial("ALLOWED")).toBeNull();
  });

  it("returns the 403 for NO_SESSION — never 401 (ADR 0077: the middleware is the only 401)", async () => {
    const res = tenantScopeDenial("NO_SESSION");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: TENANT_SCOPE_API_ERRORS.forbidden,
    });
  });

  it("returns the 403 for MISSING_PERMISSION", async () => {
    const res = tenantScopeDenial("MISSING_PERMISSION");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("returns the 404 for OUT_OF_TENANT", async () => {
    const res = tenantScopeDenial("OUT_OF_TENANT");
    expect(res).not.toBeNull();
    expect(res?.status).toBe(404);
    await expect(res?.json()).resolves.toEqual({
      error: TENANT_SCOPE_API_ERRORS.notFound,
    });
  });
});

describe("resolveTenantAxis", () => {
  it("resolves negocioId with no response when session and permission both clear", () => {
    const result = resolveTenantAxis({
      session: sesion({
        negocioId: NEGOCIO_A,
        permisos: "configuracion.locales.acceder",
      }),
      permisoRequerido: "configuracion.locales.acceder",
    });
    expect(result.negocioId).toBe(NEGOCIO_A);
    expect(result.response).toBeNull();
  });

  it("resolves negocioId with no response when no permission is required at all", () => {
    const result = resolveTenantAxis({
      session: sesion({ negocioId: NEGOCIO_A }),
      permisoRequerido: null,
    });
    expect(result.negocioId).toBe(NEGOCIO_A);
    expect(result.response).toBeNull();
  });

  it("negocioId null + a 403 response with no session", () => {
    const result = resolveTenantAxis({ session: null, permisoRequerido: null });
    expect(result.negocioId).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it("negocioId null + a 403 response when the permission is required and missing", () => {
    const result = resolveTenantAxis({
      session: sesion({ negocioId: NEGOCIO_A, permisos: "" }),
      permisoRequerido: "configuracion.locales.acceder",
    });
    expect(result.negocioId).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it("never responds 401 — the middleware is the only 401 in the system (ADR 0077, E-007)", () => {
    const result = resolveTenantAxis({ session: null, permisoRequerido: null });
    expect(result.response?.status).not.toBe(401);
  });
});
