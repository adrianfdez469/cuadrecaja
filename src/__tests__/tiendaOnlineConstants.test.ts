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
    expect(TIENDA_ONLINE_API_ERRORS).toMatchObject({
      forbidden: "FORBIDDEN",
      invalidBody: "INVALID_BODY",
      pedidoNotFound: "PEDIDO_NOT_FOUND",
      internal: "TIENDA_ONLINE_UNAVAILABLE",
    });
  });

  it("should export the four F-005 error codes verbatim (contract §1)", () => {
    expect(TIENDA_ONLINE_API_ERRORS).toMatchObject({
      tiendaNotFound: "TIENDA_NOT_FOUND",
      almacenNotPublishable: "ALMACEN_NOT_PUBLISHABLE",
      openingHoursInvalid: "OPENING_HOURS_INVALID",
      slugUpstream: "QAB_SLUG_UPSTREAM",
    });
  });

  // F-012 (contract § 1.2, § 0.2, ADR 0064)
  it("should export qabStatusUpstream verbatim — the ONE code every QAB-side outcome of the status report leaves under", () => {
    expect(TIENDA_ONLINE_API_ERRORS.qabStatusUpstream).toBe("QAB_STATUS_UPSTREAM");
  });

  it("should no longer export notImplemented — the 501 disappears from the project once this PATCH writes for real", () => {
    expect(TIENDA_ONLINE_API_ERRORS).not.toHaveProperty("notImplemented");
  });
});
