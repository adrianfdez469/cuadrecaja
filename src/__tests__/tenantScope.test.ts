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
 *
 * F-029, ADR 0107 — the module gained a per-store permission check, and the
 * contract's own instruction to the `dev-tester` (F-029 spec § 10.1) is that
 * TWO groups of cases change shape here, not one:
 *
 *   1. `decideTenantScope` gained a fourth parameter, `permisosEnTienda?:
 *      string | null`: the permission is checked against the caller's role IN
 *      THE STORE THE REQUEST ADDRESSES, never against `session.user.permisos`
 *      (the role for the user's `localActual`, which can differ per store —
 *      `UsuarioTienda.rolId` is per-store).
 *   2. `resolveTenantAxis` (GATE B: the `tiendaId` is NOT in the request, the
 *      row is addressed by its own id) LOSES its `permisoRequerido` parameter
 *      entirely — GATE B cannot know which store a row belongs to until it
 *      has been read, so it cannot derive `permisosEnTienda` at decision
 *      time. The permission is checked AFTER the route resolves its row, with
 *      a new async wrapper of this same module, `assertPermisoEnTienda({
 *      session, tiendaId, permisoRequerido })`. That wrapper touches the
 *      database (`getPermisosUsuario`) and is, like `assertTiendaTenant`,
 *      explicitly OUT of this suite's scope: it is verified by EXECUTING, not
 *      by a unit test here.
 *
 * Neither change is a regression: it is the contract ADR 0107 fixes.
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

const { TENANT_SCOPE_API_ERRORS } = await import("@/constants/tenantScope");

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
    expect(tiendaTenantWhere({ tiendaId: "t1", negocioId: NEGOCIO_A })).toEqual(
      {
        id: "t1",
        negocioId: NEGOCIO_A,
      },
    );
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
      withTenantScope(
        "cashBreakdownCierre",
        { cierrePeriodoId: "c1" },
        NEGOCIO_A,
      ),
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
});

describe("decideTenantScope", () => {
  /**
   * F-029, ADR 0107 — the permission is checked against `permisosEnTienda`
   * (the caller's role IN THE STORE THE REQUEST ADDRESSES), never against
   * `session.user.permisos` (the role for the user's `localActual`, which
   * can differ per store since `UsuarioTienda.rolId` is per-store). The
   * cases below replace the pre-F-029 ones that read the session's own
   * permisos — that shape is the bug ADR 0107 closes, not the contract.
   */
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
      decideTenantScope({
        session: null,
        permisoRequerido: null,
        ownsResource: true,
      }),
    ).toBe("NO_SESSION");
    expect(
      decideTenantScope({
        session: null,
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: false,
      }),
    ).toBe("NO_SESSION");
  });

  it("ALLOWED when no permission is required and the resource is owned — permisosEnTienda not needed at all", () => {
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

  it("THE CASE THAT MATTERS MOST (ADR 0107): permisoRequerido present and permisosEnTienda ABSENT denies — it NEVER falls back to session.user.permisos", () => {
    // The session below carries the very permission requested. If the
    // implementation fell back to it, this would wrongly be ALLOWED.
    expect(
      decideTenantScope({
        session: sesion({
          negocioId: NEGOCIO_A,
          permisos: "configuracion.locales.acceder",
        }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
        // permisosEnTienda intentionally omitted.
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("MISSING_PERMISSION when permisosEnTienda is an empty string — no role assigned to the user at THAT store", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
        permisosEnTienda: "",
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("MISSING_PERMISSION when permisosEnTienda holds a DIFFERENT permission — the role differs per store, which is the whole point of ADR 0107", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A }),
        permisoRequerido: "operaciones.cierre.cerrar",
        ownsResource: true,
        permisosEnTienda: "pos.vender",
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("THE ORDER IS THE CONTRACT: missing permission + out-of-tenant resource is MISSING_PERMISSION, never OUT_OF_TENANT", () => {
    // Contract § 2: permission is pure and checked first; ownership costs a query and
    // is only reached once permission clears. A denial-by-permission must not leak
    // whether the resource would also have been out of tenant.
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: false,
        permisosEnTienda: undefined,
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("ALLOWED when permisosEnTienda (NOT the session's permisos) carries the required permission and the resource is owned", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, permisos: "" }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
        permisosEnTienda: "configuracion.locales.acceder",
      }),
    ).toBe("ALLOWED");
  });

  it("a permission granted in the SESSION's own store does not leak into a DIFFERENT store's check — this closes the hole ADR 0107 names", () => {
    // The session was built for the user's `localActual`, which grants this
    // permission there. The request addresses a DIFFERENT store, where
    // permisosEnTienda (freshly resolved for THAT store) is empty.
    expect(
      decideTenantScope({
        session: sesion({
          negocioId: NEGOCIO_A,
          permisos: "operaciones.cierre.cerrar",
        }),
        permisoRequerido: "operaciones.cierre.cerrar",
        ownsResource: true,
        permisosEnTienda: "",
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("NEGATIVE CONTROL (E-008): a user with the SAME role in every one of their stores sees NO change from this fix — ALLOWED in store A and in store B alike", () => {
    // Without this control, "fixed" and "broken" would produce identical
    // evidence for the ordinary case (ADR 0107's own "alcance medido": 32 of
    // 39 call sites pass permisoRequerido: null and never reach this branch
    // at all; among the ones that do, the common case is one role for every
    // store). The permission comes from `permisosEnTienda`, resolved PER
    // STORE — but a consistent role means that resolution yields the SAME
    // string everywhere, so the decision must not depend on which store the
    // request addresses.
    const session = sesion({ negocioId: NEGOCIO_A });
    const consistentRole = "operaciones.cierre.cerrar";
    const decisionInStoreA = decideTenantScope({
      session,
      permisoRequerido: "operaciones.cierre.cerrar",
      ownsResource: true,
      permisosEnTienda: consistentRole, // resolved for store A
    });
    const decisionInStoreB = decideTenantScope({
      session,
      permisoRequerido: "operaciones.cierre.cerrar",
      ownsResource: true,
      permisosEnTienda: consistentRole, // resolved for store B — same string
    });
    expect(decisionInStoreA).toBe("ALLOWED");
    expect(decisionInStoreB).toBe("ALLOWED");
  });

  it("DECISION DEL HUMANO (2026-09-08): an ADMIN of the negocio NOT assigned to a store CANNOT operate on it — only SUPER_ADMIN is exempt, never ADMIN by role", () => {
    // The discriminator: a plausible-but-wrong "ADMIN governs every store of
    // its own negocio" exemption — mirroring SUPER_ADMIN's — would resolve
    // this to ALLOWED. `getPermisosUsuario` returns "" when there is no
    // `UsuarioTienda` row for this user at this store, exactly what an ADMIN
    // not assigned to it gets.
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, rol: "ADMIN" }),
        permisoRequerido: "configuracion.locales.acceder",
        ownsResource: true,
        permisosEnTienda: "", // no UsuarioTienda row for this ADMIN at this store
      }),
    ).toBe("MISSING_PERMISSION");
  });

  it("SUPER_ADMIN is granted the permission for free even with permisosEnTienda undefined — resolved from the role alone, exactly as verificarPermisoUsuario does today", () => {
    expect(
      decideTenantScope({
        session: sesion({ negocioId: NEGOCIO_A, rol: "SUPER_ADMIN" }),
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
        session: sesion({ negocioId: NEGOCIO_A, rol: "SUPER_ADMIN" }),
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

describe("resolveTenantAxis — GATE B, F-029/ADR 0107: no longer takes permisoRequerido", () => {
  /**
   * ADR 0107: this gate fires when the `tiendaId` is NOT in the request — the
   * row is addressed by its own id, so which store it belongs to is unknown
   * until it is READ. There is no `tiendaId` here to derive `permisosEnTienda`
   * from, so the permission check moves out of this function entirely, into
   * `assertPermisoEnTienda` (called by the route AFTER it resolves its row —
   * out of this suite's scope, same reasoning as `assertTiendaTenant`).
   *
   * Removing the parameter, rather than leaving it accepted and unused, is
   * deliberate (the contract's own words): a parameter that stays but checks
   * nothing is exactly the shape of the hole ADR 0107 closes, and callers
   * that still pass it must stop compiling until they adopt the new pattern.
   */
  it("resolves negocioId with no response whenever there is a session — no permission to check here anymore", () => {
    const result = resolveTenantAxis({
      session: sesion({ negocioId: NEGOCIO_A }),
    });
    expect(result.negocioId).toBe(NEGOCIO_A);
    expect(result.response).toBeNull();
  });

  it("negocioId null + a 403 response with no session", () => {
    const result = resolveTenantAxis({ session: null });
    expect(result.negocioId).toBeNull();
    expect(result.response?.status).toBe(403);
  });

  it("never responds 401 — the middleware is the only 401 in the system (ADR 0077, E-007)", () => {
    const result = resolveTenantAxis({ session: null });
    expect(result.response?.status).not.toBe(401);
  });
});
