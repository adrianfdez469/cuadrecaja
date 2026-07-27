import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { assertNegocioConfigAccess } from "@/lib/negocioConfigAccess";

/**
 * Regresión de seguridad: las rutas de configuración de negocio (monedas y tasas de
 * cambio) solo validaban `session?.user`. Cualquier usuario autenticado que conociera
 * el UUID de otro negocio podía leer y ESCRIBIR su configuración.
 */

const NEGOCIO_PROPIO = "negocio-propio-uuid";
const NEGOCIO_AJENO = "negocio-ajeno-uuid";

const sesion = (over: {
  negocioId?: string;
  permisos?: string;
  rol?: string;
}): Session =>
  ({
    user: {
      id: "user-1",
      negocio: over.negocioId ? { id: over.negocioId } : undefined,
      permisos: over.permisos ?? "configuracion.administrador",
      rol: over.rol ?? "ADMIN",
    },
  }) as unknown as Session;

describe("assertNegocioConfigAccess", () => {
  it("deja pasar al admin del propio negocio con el permiso", () => {
    const res = assertNegocioConfigAccess(
      sesion({ negocioId: NEGOCIO_PROPIO }),
      NEGOCIO_PROPIO,
    );
    expect(res).toBeNull();
  });

  it("responde 401 si no hay sesión", async () => {
    const res = assertNegocioConfigAccess(null, NEGOCIO_PROPIO);
    expect(res?.status).toBe(401);
  });

  it("responde 403 al intentar acceder a la configuración de OTRO negocio", async () => {
    // El agujero original: esto devolvía los datos del negocio ajeno.
    const res = assertNegocioConfigAccess(
      sesion({ negocioId: NEGOCIO_PROPIO }),
      NEGOCIO_AJENO,
    );
    expect(res?.status).toBe(403);
  });

  it("responde 403 aunque el usuario sea SUPER_ADMIN, si el negocio no es el suyo", async () => {
    const res = assertNegocioConfigAccess(
      sesion({ negocioId: NEGOCIO_PROPIO, rol: "SUPER_ADMIN" }),
      NEGOCIO_AJENO,
    );
    expect(res?.status).toBe(403);
  });

  it("responde 403 al usuario del propio negocio sin el permiso de configuración", async () => {
    const res = assertNegocioConfigAccess(
      sesion({
        negocioId: NEGOCIO_PROPIO,
        permisos: "pos.vender|inventario.ver",
      }),
      NEGOCIO_PROPIO,
    );
    expect(res?.status).toBe(403);
  });

  it("deja pasar a SUPER_ADMIN sin permisos explícitos en su propio negocio", () => {
    const res = assertNegocioConfigAccess(
      sesion({ negocioId: NEGOCIO_PROPIO, permisos: "", rol: "SUPER_ADMIN" }),
      NEGOCIO_PROPIO,
    );
    expect(res).toBeNull();
  });

  it("responde 403 si el usuario no tiene negocio asignado", async () => {
    const res = assertNegocioConfigAccess(sesion({}), NEGOCIO_PROPIO);
    expect(res?.status).toBe(403);
  });
});
