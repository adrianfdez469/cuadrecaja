import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

/**
 * F-004 — the online-store module gate, `src/lib/tiendaOnline/tiendaOnlineAccess.ts`.
 *
 * `decideTiendaOnlineAccess` is PURE and synchronous (session injected, no I/O) precisely so
 * this file can test it without a server. The rule the whole feature exists to protect
 * (`.agents/specs/F-004.md` §0, ADR 0028): **the `Negocio.tiendaOnlineHabilitada` switch wins
 * ALWAYS, SUPER_ADMIN included**, because `verificarPermisoUsuario`/`verificarPermiso` bypass
 * every permission check for that role. The switch is therefore evaluated BEFORE `rol` or
 * `permisos` are ever looked at.
 *
 * Every "switch wins" case below is built so the user WOULD otherwise pass the permission
 * gate (SUPER_ADMIN, or an ADMIN whose `permisos` string literally contains the permission
 * being requested) — see E-008: a test where the user could not have passed the permission
 * gate either way proves nothing about ordering.
 *
 * `isTiendaOnlineEnabled` and `assertTiendaOnlineAccess` touch Prisma, so `@/lib/prisma` is
 * mocked here (external dependency); `verificarPermisoUsuario` (`@/utils/permisos_back`) is
 * NOT mocked — it is pre-existing, pure logic outside this feature's scope, and using the real
 * implementation is what makes these tests exercise the real composition.
 */

const findUniqueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    negocio: {
      findUnique: findUniqueMock,
    },
  },
}));

const {
  decideTiendaOnlineAccess,
  isTiendaOnlineEnabled,
  tiendaOnlineForbiddenResponse,
  assertTiendaOnlineAccess,
  NEGOCIO_TIENDA_ONLINE_SWITCH_SELECT,
} = await import("@/lib/tiendaOnline/tiendaOnlineAccess");

const { TIENDA_ONLINE_PERMISOS, TIENDA_ONLINE_API_ERRORS } = await import(
  "@/constants/tiendaOnline"
);

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

const sesion = (over: {
  sinNegocio?: boolean;
  permisos?: string;
  rol?: string;
}): Session =>
  ({
    user: {
      id: "user-1",
      negocio: over.sinNegocio ? undefined : { id: NEGOCIO_ID },
      permisos: over.permisos ?? "",
      rol: over.rol ?? "ADMIN",
    },
  }) as unknown as Session;

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("decideTiendaOnlineAccess", () => {
  it("should return NO_SESSION when there is no session at all", () => {
    const result = decideTiendaOnlineAccess({
      session: null,
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    });

    expect(result).toEqual({ allowed: false, reason: "NO_SESSION" });
  });

  it("should return NO_SESSION when the session has no negocio.id", () => {
    const result = decideTiendaOnlineAccess({
      session: sesion({ sinNegocio: true }),
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    });

    expect(result).toEqual({ allowed: false, reason: "NO_SESSION" });
  });

  it("THE test of the feature: the switch off beats a SUPER_ADMIN with no permisos at all", () => {
    // rol: SUPER_ADMIN, permisos: "", moduleEnabled: false -> MODULE_DISABLED.
    // Literally the case the contract §3 says "dev-tester must cover, no exceptions".
    const result = decideTiendaOnlineAccess({
      session: sesion({ rol: "SUPER_ADMIN", permisos: "" }),
      moduleEnabled: false,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    });

    expect(result).toEqual({ allowed: false, reason: "MODULE_DISABLED" });
  });

  it("the switch off beats an ADMIN who genuinely HAS the requested permission (E-008 guard)", () => {
    // If the implementation checked the permission before the switch, this user would pass
    // the permission gate (their `permisos` string contains exactly what is requested) and the
    // bug would read as "allowed" instead of MODULE_DISABLED. This is what makes the test
    // discriminate between the two orderings, unlike a user who lacks the permission anyway.
    const result = decideTiendaOnlineAccess({
      session: sesion({
        rol: "ADMIN",
        permisos: [
          TIENDA_ONLINE_PERMISOS.configuracionAcceder,
          TIENDA_ONLINE_PERMISOS.pedidosAcceder,
          TIENDA_ONLINE_PERMISOS.pedidosGestionar,
          TIENDA_ONLINE_PERMISOS.pedidosProponer,
        ].join("|"),
      }),
      moduleEnabled: false,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    });

    expect(result).toEqual({ allowed: false, reason: "MODULE_DISABLED" });
  });

  it("order is observable: switch off AND permission missing still reports MODULE_DISABLED, not MISSING_PERMISSION", () => {
    // Same 403 on the wire either way (§5) — this is the one thing that catches the checks
    // being run in the wrong order, because the reason is only visible to this unit test.
    const result = decideTiendaOnlineAccess({
      session: sesion({ rol: "ADMIN", permisos: "" }),
      moduleEnabled: false,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    });

    expect(result.allowed).toBe(false);
    expect((result as { reason: string }).reason).toBe("MODULE_DISABLED");
  });

  it("should return MISSING_PERMISSION when the switch is on but the permission is absent", () => {
    const result = decideTiendaOnlineAccess({
      session: sesion({ rol: "ADMIN", permisos: "pos.vender" }),
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    });

    expect(result).toEqual({ allowed: false, reason: "MISSING_PERMISSION" });
  });

  it("criterion 5: switch on, has .acceder but not .gestionar, requesting .gestionar -> MISSING_PERMISSION", () => {
    const result = decideTiendaOnlineAccess({
      session: sesion({
        rol: "USER",
        permisos: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
      }),
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.pedidosGestionar,
    });

    expect(result).toEqual({ allowed: false, reason: "MISSING_PERMISSION" });
  });

  it("should still let SUPER_ADMIN's role bypass through, as long as the module IS enabled", () => {
    // The switch is not a permission, but the permission bypass for SUPER_ADMIN is not revoked
    // either: it only loses the race against the switch, never against the permission itself.
    const result = decideTiendaOnlineAccess({
      session: sesion({ rol: "SUPER_ADMIN", permisos: "" }),
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.pedidosGestionar,
    });

    expect(result).toEqual({ allowed: true, negocioId: NEGOCIO_ID });
  });

  it("should allow and return the session's negocioId when the switch is on and the permission is present", () => {
    const result = decideTiendaOnlineAccess({
      session: sesion({
        rol: "USER",
        permisos: TIENDA_ONLINE_PERMISOS.configuracionAcceder,
      }),
      moduleEnabled: true,
      permisoRequerido: TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    });

    expect(result).toEqual({ allowed: true, negocioId: NEGOCIO_ID });
  });
});

describe("isTiendaOnlineEnabled", () => {
  it("should return true when the business row has the switch on", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    await expect(isTiendaOnlineEnabled(NEGOCIO_ID)).resolves.toBe(true);
  });

  it("should return false when the business row has the switch off", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: false });

    await expect(isTiendaOnlineEnabled(NEGOCIO_ID)).resolves.toBe(false);
  });

  it("should fail closed (return false) when the business does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(isTiendaOnlineEnabled(NEGOCIO_ID)).resolves.toBe(false);
  });

  it("should read the switch with an explicit single-column select, never the whole row", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    await isTiendaOnlineEnabled(NEGOCIO_ID);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: NEGOCIO_ID },
      select: NEGOCIO_TIENDA_ONLINE_SWITCH_SELECT,
    });
  });
});

describe("tiendaOnlineForbiddenResponse", () => {
  it("should respond 403 with the FORBIDDEN body and a no-store header", async () => {
    const res = tiendaOnlineForbiddenResponse();

    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({
      error: TIENDA_ONLINE_API_ERRORS.forbidden,
    });
  });

  it("should never be a 401 (E-007: a 401 here would sign the user out)", () => {
    const res = tiendaOnlineForbiddenResponse();

    expect(res.status).not.toBe(401);
  });
});

describe("assertTiendaOnlineAccess", () => {
  it("should respond 403 without touching the database when there is no session", async () => {
    const res = await assertTiendaOnlineAccess(
      null,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("should never return a 401 for a missing session (only the middleware's gate does, ADR 0016)", async () => {
    const res = await assertTiendaOnlineAccess(
      null,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );

    expect(res?.status).not.toBe(401);
  });

  it("should respond 403 when the switch is off, even for a SUPER_ADMIN with the permission", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: false });

    const res = await assertTiendaOnlineAccess(
      sesion({ rol: "SUPER_ADMIN", permisos: "" }),
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("should respond 403 when the switch is on but the permission is missing", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccess(
      sesion({ rol: "USER", permisos: "" }),
      TIENDA_ONLINE_PERMISOS.pedidosGestionar,
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("criterion 5: should respond 403 for .acceder-only when .gestionar is required", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccess(
      sesion({
        rol: "USER",
        permisos: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
      }),
      TIENDA_ONLINE_PERMISOS.pedidosGestionar,
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("should allow (return null) when the switch is on and the permission is present", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccess(
      sesion({
        rol: "USER",
        permisos: TIENDA_ONLINE_PERMISOS.pedidosAcceder,
      }),
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );

    expect(res).toBeNull();
  });
});
