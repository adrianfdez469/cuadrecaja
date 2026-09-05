import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

/**
 * F-006 — the two-permission gate, `decideTiendaOnlineAccessAll` /
 * `assertTiendaOnlineAccessAll` / `hasTiendaOnlinePermisos`
 * (`src/lib/tiendaOnline/tiendaOnlineAccess.ts`, contract §6.3). Acceptance
 * criterion 19: a user with `tiendaonline.configuracion.acceder` but WITHOUT
 * `operaciones.inventario.acceder` must be refused with a 403 when they force
 * the PATCH — even though the front end lets them see the tab.
 *
 * Same mocking strategy and same "switch wins over SUPER_ADMIN" discipline as
 * `tiendaOnlineAccess.test.ts` (F-004): `@/lib/prisma` is mocked (external
 * dependency), `verificarPermisoUsuario` is the real implementation.
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
  decideTiendaOnlineAccessAll,
  hasTiendaOnlinePermisos,
  assertTiendaOnlineAccessAll,
} = await import("@/lib/tiendaOnline/tiendaOnlineAccess");

const { TIENDA_ONLINE_PERMISOS, TIENDA_ONLINE_EXTRA_PERMISOS, TIENDA_ONLINE_API_ERRORS } =
  await import("@/constants/tiendaOnline");

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

const REQUIRED = [
  TIENDA_ONLINE_PERMISOS.configuracionAcceder,
  TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
];

const sesion = (over: { sinNegocio?: boolean; permisos?: string; rol?: string }): Session =>
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

describe("hasTiendaOnlinePermisos", () => {
  it("should be false with no session at all", () => {
    expect(hasTiendaOnlinePermisos(null, REQUIRED)).toBe(false);
  });

  it("criterion 19's exact case: false when the user holds ONLY configuracionAcceder, not BOTH required permissions", () => {
    const result = hasTiendaOnlinePermisos(
      sesion({ rol: "USER", permisos: TIENDA_ONLINE_PERMISOS.configuracionAcceder }),
      REQUIRED
    );

    expect(result).toBe(false);
  });

  it("should be false when the user holds ONLY the inventory permission, not the module one", () => {
    const result = hasTiendaOnlinePermisos(
      sesion({ rol: "USER", permisos: TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder }),
      REQUIRED
    );

    expect(result).toBe(false);
  });

  it("should be true only when the user holds BOTH permissions", () => {
    const result = hasTiendaOnlinePermisos(
      sesion({
        rol: "USER",
        permisos: [
          TIENDA_ONLINE_PERMISOS.configuracionAcceder,
          TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
        ].join("|"),
      }),
      REQUIRED
    );

    expect(result).toBe(true);
  });

  it("SUPER_ADMIN should hold both without an explicit permisos string, via verificarPermisoUsuario's role bypass", () => {
    const result = hasTiendaOnlinePermisos(sesion({ rol: "SUPER_ADMIN", permisos: "" }), REQUIRED);

    expect(result).toBe(true);
  });
});

describe("decideTiendaOnlineAccessAll", () => {
  it("should return NO_SESSION when there is no session", () => {
    expect(
      decideTiendaOnlineAccessAll({
        session: null,
        moduleEnabled: true,
        permisosRequeridos: REQUIRED,
      })
    ).toEqual({ allowed: false, reason: "NO_SESSION" });
  });

  it("the switch off should beat a SUPER_ADMIN with both permissions implicitly granted (E-008 guard, ADR 0028)", () => {
    const result = decideTiendaOnlineAccessAll({
      session: sesion({ rol: "SUPER_ADMIN", permisos: "" }),
      moduleEnabled: false,
      permisosRequeridos: REQUIRED,
    });

    expect(result).toEqual({ allowed: false, reason: "MODULE_DISABLED" });
  });

  it("criterion 19: switch ON, has configuracionAcceder but NOT the inventory permission -> MISSING_PERMISSION", () => {
    const result = decideTiendaOnlineAccessAll({
      session: sesion({ rol: "USER", permisos: TIENDA_ONLINE_PERMISOS.configuracionAcceder }),
      moduleEnabled: true,
      permisosRequeridos: REQUIRED,
    });

    expect(result).toEqual({ allowed: false, reason: "MISSING_PERMISSION" });
  });

  it("should allow and return negocioId when the switch is on and BOTH permissions are present", () => {
    const result = decideTiendaOnlineAccessAll({
      session: sesion({
        rol: "USER",
        permisos: [
          TIENDA_ONLINE_PERMISOS.configuracionAcceder,
          TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
        ].join("|"),
      }),
      moduleEnabled: true,
      permisosRequeridos: REQUIRED,
    });

    expect(result).toEqual({ allowed: true, negocioId: NEGOCIO_ID });
  });
});

describe("assertTiendaOnlineAccessAll", () => {
  it("criterion 19: should respond 403 when the switch is on but only the module permission is held, not the inventory one", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccessAll(
      sesion({ rol: "USER", permisos: TIENDA_ONLINE_PERMISOS.configuracionAcceder }),
      REQUIRED
    );

    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
  });

  it("should respond with the SAME body as the single-permission gate — never says which of the two permissions was missing", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccessAll(
      sesion({ rol: "USER", permisos: "" }),
      REQUIRED
    );

    await expect(res?.json()).resolves.toEqual({ error: TIENDA_ONLINE_API_ERRORS.forbidden });
  });

  it("should never respond 401 (E-007)", async () => {
    const res = await assertTiendaOnlineAccessAll(null, REQUIRED);

    expect(res?.status).not.toBe(401);
  });

  it("should allow (return null) when the switch is on and BOTH permissions are present", async () => {
    findUniqueMock.mockResolvedValueOnce({ tiendaOnlineHabilitada: true });

    const res = await assertTiendaOnlineAccessAll(
      sesion({
        rol: "USER",
        permisos: [
          TIENDA_ONLINE_PERMISOS.configuracionAcceder,
          TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
        ].join("|"),
      }),
      REQUIRED
    );

    expect(res).toBeNull();
  });
});
