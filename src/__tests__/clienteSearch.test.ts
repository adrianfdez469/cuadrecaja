import { describe, it, expect } from "vitest";
import type { IClienteOption } from "@/schemas/clienteSaldo";

/**
 * F-033, contract § 4.4, § 11.1 — `src/lib/clientes/clienteSearch.ts`.
 *
 * Namespace import (not destructured at module scope): several symbols live here and
 * the module may exist with only some of them implemented while `implementer` is still
 * working. Referencing `mod.symbol` inside each test body keeps a missing export local
 * to the test that uses it instead of tumbling the whole file at collection (E-019).
 */
const mod = await import("@/lib/clientes/clienteSearch");

function option(overrides: Partial<IClienteOption> = {}): IClienteOption {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    nombre: "Ana Pérez",
    telefono: null,
    saldo: 0,
    ...overrides,
  };
}

describe("CLIENTE_SEARCH_SOURCES and CLIENTE_CREATE_BLOCK_REASONS — closed vocabularies", () => {
  it("CLIENTE_SEARCH_SOURCES is exactly server/cache", () => {
    expect(mod.CLIENTE_SEARCH_SOURCES).toEqual(["server", "cache"]);
  });

  it("CLIENTE_CREATE_BLOCK_REASONS is exactly sin-permiso/offline", () => {
    expect(mod.CLIENTE_CREATE_BLOCK_REASONS).toEqual(["sin-permiso", "offline"]);
  });
});

describe("matchesClienteTerm", () => {
  it("matches case-insensitively against nombre", () => {
    expect(mod.matchesClienteTerm(option({ nombre: "Ana Pérez" }), "ana")).toBe(true);
    expect(mod.matchesClienteTerm(option({ nombre: "Ana Pérez" }), "PÉREZ")).toBe(true);
  });

  it("does not match a term absent from nombre", () => {
    expect(mod.matchesClienteTerm(option({ nombre: "Ana Pérez" }), "carlos")).toBe(false);
  });

  it("is NOT accent-insensitive: an unaccented term does not match an accented nombre", () => {
    expect(mod.matchesClienteTerm(option({ nombre: "José" }), "jose")).toBe(false);
    expect(mod.matchesClienteTerm(option({ nombre: "José" }), "José")).toBe(true);
  });

  it("compares against nombre only, never telefono", () => {
    const opt = option({ nombre: "Ana Pérez", telefono: "55551234" });
    expect(mod.matchesClienteTerm(opt, "55551234")).toBe(false);
  });

  it(
    'an empty term matches — the same "contains: \'\'" the server does, so online ' +
      "and offline answer the same question for an untyped search (edge case found " +
      "by the implementer)",
    () => {
      expect(mod.matchesClienteTerm(option({ nombre: "Ana Pérez" }), "")).toBe(true);
    },
  );
});

describe("filterClientesCache", () => {
  it("returns only options matching term, preserving stored order", () => {
    const options = [
      option({ id: "1", nombre: "Ana Pérez" }),
      option({ id: "2", nombre: "Bruno Gómez" }),
      option({ id: "3", nombre: "Ana María" }),
    ];
    const result = mod.filterClientesCache(options, "ana", 10);
    expect(result.map((o) => o.id)).toEqual(["1", "3"]);
  });

  it("caps the result at limit", () => {
    const options = [
      option({ id: "1", nombre: "Ana Pérez" }),
      option({ id: "2", nombre: "Ana María" }),
      option({ id: "3", nombre: "Ana Luisa" }),
    ];
    const result = mod.filterClientesCache(options, "ana", 2);
    expect(result).toHaveLength(2);
    expect(result.map((o) => o.id)).toEqual(["1", "2"]);
  });

  it("an empty term yields the first `limit` options, unfiltered", () => {
    const options = [
      option({ id: "1", nombre: "Zoe" }),
      option({ id: "2", nombre: "Ana" }),
      option({ id: "3", nombre: "Bruno" }),
    ];
    const result = mod.filterClientesCache(options, "", 2);
    expect(result.map((o) => o.id)).toEqual(["1", "2"]);
  });

  it("a whitespace-only term is treated the same as an empty term", () => {
    const options = [
      option({ id: "1", nombre: "Zoe" }),
      option({ id: "2", nombre: "Ana" }),
    ];
    const result = mod.filterClientesCache(options, "   ", 10);
    expect(result.map((o) => o.id)).toEqual(["1", "2"]);
  });

  it("limit <= 0 or non-finite yields [] (edge case found by the implementer)", () => {
    const options = [
      option({ id: "1", nombre: "Zoe" }),
      option({ id: "2", nombre: "Ana" }),
    ];
    expect(mod.filterClientesCache(options, "", 0)).toEqual([]);
    expect(mod.filterClientesCache(options, "", -1)).toEqual([]);
    expect(mod.filterClientesCache(options, "", NaN)).toEqual([]);
    expect(mod.filterClientesCache(options, "", Infinity)).toEqual([]);
  });
});

describe("resolveCreateAvailability", () => {
  it('permission absent wins over connectivity: offline AND no permission -> "sin-permiso"', () => {
    // This is the case that discriminates the mandated order (§ 4.4): a wrong
    // implementation that checked connectivity first would answer "offline" here.
    expect(
      mod.resolveCreateAvailability({ isOnline: false, hasPermission: false }),
    ).toEqual({ canCreate: false, blockReason: "sin-permiso" });
  });

  it('permission present but no permission wins when online too -> "sin-permiso"', () => {
    expect(
      mod.resolveCreateAvailability({ isOnline: true, hasPermission: false }),
    ).toEqual({ canCreate: false, blockReason: "sin-permiso" });
  });

  it('permission present, offline -> "offline"', () => {
    expect(
      mod.resolveCreateAvailability({ isOnline: false, hasPermission: true }),
    ).toEqual({ canCreate: false, blockReason: "offline" });
  });

  it("permission present and online -> can create, no block reason", () => {
    expect(
      mod.resolveCreateAvailability({ isOnline: true, hasPermission: true }),
    ).toEqual({ canCreate: true, blockReason: null });
  });
});
