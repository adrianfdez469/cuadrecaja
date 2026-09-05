import { describe, it, expect, vi } from "vitest";
import type { Session } from "next-auth";

/**
 * F-011 — `src/lib/tiendaOnline/tiendaOnlineOrderAccess.ts` (contract § 3, ADR 0056).
 *
 * This file covers ONLY the pure/synchronous surface named by contract § 9.4:
 * `decideTiendaOnlineOrderManage`, `manageableTiendaIds`, `tiendaOnlineOrderNotFoundResponse`
 * and `tiendaOnlineOrderManageDenial`. `resolveTiendaOnlineOrderScope` reads `UsuarioTienda`
 * from Prisma and is explicitly OUT of the suite's scope (§ 9.4): it is verified by
 * executing, not by a unit test.
 *
 * `@/lib/prisma` is still mocked, defensively, because the module imports the singleton
 * at the top level even though this file never calls the one function that uses it.
 *
 * Criteria 14/15/16 are the point of this file: they distinguish the THREE readings of
 * ".gestionar" the spec calls out (ADR 0056's "alternativas consideradas" table). The
 * fixture below is the one the spec's own § 9.5 note 1 prescribes: tienda A (active,
 * `.acceder` + `.gestionar`), tienda B (assigned, neither), tienda C (assigned,
 * `.gestionar` only, NOT active).
 */

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const {
  decideTiendaOnlineOrderManage,
  manageableTiendaIds,
  tiendaOnlineOrderNotFoundResponse,
  tiendaOnlineOrderManageDenial,
} = await import("@/lib/tiendaOnline/tiendaOnlineOrderAccess");

const { TIENDA_ONLINE_PERMISOS, TIENDA_ONLINE_API_ERRORS } = await import(
  "@/constants/tiendaOnline"
);
const { NO_STORE_HEADERS } = await import("@/lib/qab/qabRouteHttp");

const TIENDA_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TIENDA_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TIENDA_C = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const TIENDA_OUT_OF_SCOPE = "dddddddd-dddd-dddd-dddd-dddddddddddd";

const sesion = (rol: string = "VENDEDOR"): Session =>
  ({
    user: {
      id: "user-1",
      negocio: { id: "negocio-1" },
      // `.gestionar` is resolved per-store from `scope.permisos`, never from this
      // session-wide string — it is intentionally irrelevant here except to prove that.
      permisos: "",
      rol,
    },
  }) as unknown as Session;

/**
 * Same montage the spec's § 9.5 note 1 prescribes for criteria 14/15/16: A carries
 * BOTH permissions (it is the active store), B carries neither, C carries ONLY
 * `.gestionar` and is never active.
 */
const scopeABC = {
  tiendaIds: [TIENDA_A, TIENDA_B, TIENDA_C],
  permisos: {
    [TIENDA_A]: `${TIENDA_ONLINE_PERMISOS.pedidosAcceder}|${TIENDA_ONLINE_PERMISOS.pedidosGestionar}`,
    [TIENDA_B]: "operaciones.inventario.acceder",
    [TIENDA_C]: TIENDA_ONLINE_PERMISOS.pedidosGestionar,
  },
};

describe("decideTiendaOnlineOrderManage", () => {
  it("FORBIDDEN when there is no session at all, regardless of scope or tiendaId", () => {
    const result = decideTiendaOnlineOrderManage({
      session: null,
      scope: scopeABC,
      tiendaId: TIENDA_A,
    });

    expect(result).toBe("FORBIDDEN");
  });

  it("OUT_OF_SCOPE when tiendaId is null (order resolved to no owning store)", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion(),
      scope: scopeABC,
      tiendaId: null,
    });

    expect(result).toBe("OUT_OF_SCOPE");
  });

  it("OUT_OF_SCOPE when tiendaId is not among the user's assigned stores", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_OUT_OF_SCOPE,
    });

    expect(result).toBe("OUT_OF_SCOPE");
  });

  it("criterion 15: ALLOWED for a store the user holds .gestionar in, even though it is NOT the active store", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_C,
    });

    expect(result).toBe("ALLOWED");
  });

  it("criterion 16: FORBIDDEN for a store the user IS assigned to, but without .gestionar there — despite holding it in A and C", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_B,
    });

    expect(result).toBe("FORBIDDEN");
  });

  it("ALLOWED for the active store A, which also carries .gestionar", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_A,
    });

    expect(result).toBe("ALLOWED");
  });

  it("SUPER_ADMIN is ALLOWED via `rol` alone, even with an empty permisos string for that store", () => {
    const result = decideTiendaOnlineOrderManage({
      session: sesion("SUPER_ADMIN"),
      scope: { tiendaIds: [TIENDA_A], permisos: { [TIENDA_A]: "" } },
      tiendaId: TIENDA_A,
    });

    expect(result).toBe("ALLOWED");
  });

  it("does NOT re-check the module switch — that is not this function's job (it is not a gate on its own)", () => {
    // No assertion possible on I/O the function never performs; documented here so a
    // future reader does not add a switch parameter expecting one.
    expect(
      decideTiendaOnlineOrderManage({
        session: sesion(),
        scope: scopeABC,
        tiendaId: TIENDA_A,
      }),
    ).toBe("ALLOWED");
  });
});

describe("manageableTiendaIds", () => {
  it("returns exactly the subset of scope.tiendaIds the session may manage — asymmetric per criteria 15/16", () => {
    const result = manageableTiendaIds(sesion(), scopeABC);

    expect(result).toEqual(new Set([TIENDA_A, TIENDA_C]));
    expect(result.has(TIENDA_B)).toBe(false);
  });

  it("returns an empty set with an empty scope", () => {
    const result = manageableTiendaIds(sesion(), { tiendaIds: [], permisos: {} });

    expect(result.size).toBe(0);
  });

  it("returns an empty set with no session, even with a scope that would otherwise allow everything", () => {
    const result = manageableTiendaIds(null, scopeABC);

    expect(result.size).toBe(0);
  });
});

describe("tiendaOnlineOrderNotFoundResponse", () => {
  it("responds 404 PEDIDO_NOT_FOUND with the module's no-store headers", async () => {
    const res = tiendaOnlineOrderNotFoundResponse();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({
      error: TIENDA_ONLINE_API_ERRORS.pedidoNotFound,
    });
    for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
      expect(res.headers.get(key)).toBe(value);
    }
  });

  it("is never a 401 or a 403 (this is the unified 404, not the module's forbidden response)", () => {
    const res = tiendaOnlineOrderNotFoundResponse();

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

describe("tiendaOnlineOrderManageDenial", () => {
  it("returns null when ALLOWED, so the caller proceeds", () => {
    const result = tiendaOnlineOrderManageDenial({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_A,
    });

    expect(result).toBeNull();
  });

  it("returns the module's 403 FORBIDDEN when the store is assigned but lacks .gestionar (criterion 16)", async () => {
    const result = tiendaOnlineOrderManageDenial({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_B,
    });

    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
    await expect(result?.json()).resolves.toEqual({
      error: TIENDA_ONLINE_API_ERRORS.forbidden,
    });
  });

  it("returns the unified 404 PEDIDO_NOT_FOUND when the order is out of scope (tiendaId null or unassigned)", async () => {
    const outOfScopeNull = tiendaOnlineOrderManageDenial({
      session: sesion(),
      scope: scopeABC,
      tiendaId: null,
    });
    const outOfScopeUnassigned = tiendaOnlineOrderManageDenial({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_OUT_OF_SCOPE,
    });

    for (const result of [outOfScopeNull, outOfScopeUnassigned]) {
      expect(result).not.toBeNull();
      expect(result?.status).toBe(404);
      await expect(result?.json()).resolves.toEqual({
        error: TIENDA_ONLINE_API_ERRORS.pedidoNotFound,
      });
    }
  });

  it("criterion 15: returns null (ALLOWED) for a .gestionar-only, non-active store", () => {
    const result = tiendaOnlineOrderManageDenial({
      session: sesion(),
      scope: scopeABC,
      tiendaId: TIENDA_C,
    });

    expect(result).toBeNull();
  });
});
