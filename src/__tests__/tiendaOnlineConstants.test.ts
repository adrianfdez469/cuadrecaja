import { describe, it, expect } from "vitest";
import {
  TIENDA_ONLINE_PERMISOS,
  TIENDA_ONLINE_ROUTES,
  TIENDA_ONLINE_API_BASE,
  TIENDA_ONLINE_API_ERRORS,
} from "@/constants/tiendaOnline";

/**
 * F-004 — `src/constants/tiendaOnline.ts` is the single source of the module's strings
 * (`AGENTS.md` § Prohibiciones -> Hardcoding). The contract (`.agents/specs/F-004.md` §1) fixes
 * every one of these values literally; a typo here is invisible to TypeScript (they are all
 * plain strings) and would silently break a permission grant, a route, or the wire contract
 * with the frontend — this is the test that would catch it.
 */

describe("TIENDA_ONLINE_PERMISOS", () => {
  it("should export the four permission keys verbatim, matching permisos.json's naming convention", () => {
    expect(TIENDA_ONLINE_PERMISOS).toEqual({
      configuracionAcceder: "tiendaonline.configuracion.acceder",
      pedidosAcceder: "tiendaonline.pedidos.acceder",
      pedidosGestionar: "tiendaonline.pedidos.gestionar",
      pedidosProponer: "tiendaonline.pedidos.proponer",
    });
  });
});

describe("TIENDA_ONLINE_ROUTES", () => {
  it("should export the two page routes verbatim", () => {
    expect(TIENDA_ONLINE_ROUTES).toEqual({
      configuracion: "/tienda-online/configuracion",
      pedidos: "/tienda-online/pedidos",
    });
  });
});

describe("TIENDA_ONLINE_API_BASE", () => {
  it("should be the fixed API base path", () => {
    expect(TIENDA_ONLINE_API_BASE).toBe("/api/tienda-online");
  });
});

describe("TIENDA_ONLINE_API_ERRORS", () => {
  it("should export the fixed error codes verbatim, including the 500 body (security finding, §6)", () => {
    expect(TIENDA_ONLINE_API_ERRORS).toEqual({
      forbidden: "FORBIDDEN",
      invalidBody: "INVALID_BODY",
      pedidoNotFound: "PEDIDO_NOT_FOUND",
      notImplemented: "NOT_IMPLEMENTED",
      internal: "TIENDA_ONLINE_UNAVAILABLE",
    });
  });

});
