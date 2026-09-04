import { describe, it, expect } from "vitest";
import permisos from "@/constants/permisos/permisos.json";
import { permisosTemplates } from "@/constants/permisos/permisos.templates";
import { TIENDA_ONLINE_PERMISOS } from "@/constants/tiendaOnline";

/**
 * F-004 — acceptance criteria 1 and 2, converted to executable tests directly against the
 * data files (`src/constants/permisos/permisos.json` and `.../permisos.templates.ts`), which
 * are pure JSON/TS data — no server, no mocking needed.
 */

const CLAVES_TIENDA_ONLINE = [
  "tiendaonline.configuracion.acceder",
  "tiendaonline.pedidos.acceder",
  "tiendaonline.pedidos.gestionar",
  "tiendaonline.pedidos.proponer",
] as const;

type IPermisosJson = Record<string, { descripcion?: string }>;

describe("permisos.json — criterion 1: the four tiendaonline keys, each with a descripcion", () => {
  it.each(CLAVES_TIENDA_ONLINE)("should declare %s", (clave) => {
    const entry = (permisos as IPermisosJson)[clave];

    expect(entry).toBeDefined();
  });

  it.each(CLAVES_TIENDA_ONLINE)("%s should have a non-empty descripcion", (clave) => {
    const entry = (permisos as IPermisosJson)[clave];

    expect(entry?.descripcion).toEqual(expect.any(String));
    expect(entry?.descripcion?.trim().length).toBeGreaterThan(0);
  });
});

describe("permisos.templates.ts — criterion 2", () => {
  it("administrador should include all four tiendaonline permissions", () => {
    for (const clave of CLAVES_TIENDA_ONLINE) {
      expect(permisosTemplates.administrador).toContain(clave);
    }
  });

  it("vendedor should include tiendaonline.pedidos.acceder and .gestionar", () => {
    expect(permisosTemplates.vendedor).toContain(
      "tiendaonline.pedidos.acceder",
    );
    expect(permisosTemplates.vendedor).toContain(
      "tiendaonline.pedidos.gestionar",
    );
  });

  it("vendedor should NOT include tiendaonline.configuracion.acceder", () => {
    expect(permisosTemplates.vendedor).not.toContain(
      "tiendaonline.configuracion.acceder",
    );
  });

  it("vendedor should NOT include tiendaonline.pedidos.proponer", () => {
    expect(permisosTemplates.vendedor).not.toContain(
      "tiendaonline.pedidos.proponer",
    );
  });

  it("almacenero should remain untouched by this feature — no tiendaonline permission at all", () => {
    for (const clave of CLAVES_TIENDA_ONLINE) {
      expect(permisosTemplates.almacenero).not.toContain(clave);
    }
  });
});

describe("cross-file consistency — §11: the strings must match EXACTLY across files", () => {
  it("every TIENDA_ONLINE_PERMISOS value must be a declared key of permisos.json", () => {
    // A one-letter drift here creates a permission nobody can grant, and no type system
    // catches it (both sides are plain strings). This is the test that would.
    for (const clave of Object.values(TIENDA_ONLINE_PERMISOS)) {
      expect(permisos).toHaveProperty(clave);
    }
  });

  it("TIENDA_ONLINE_PERMISOS should have exactly the four keys the criteria require, no more no less", () => {
    expect(Object.values(TIENDA_ONLINE_PERMISOS).sort()).toEqual(
      [...CLAVES_TIENDA_ONLINE].sort(),
    );
  });
});
