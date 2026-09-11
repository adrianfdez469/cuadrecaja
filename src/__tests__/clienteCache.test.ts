import { describe, it, expect } from "vitest";
import type { IClienteConSaldo, IClienteOption } from "@/schemas/clienteSaldo";

/**
 * F-033, contract § 4.5, § 11.1 — `src/lib/clientes/clienteCache.ts`.
 *
 * Namespace import: the module may exist with only some of its three symbols
 * implemented while `implementer` is still working; referencing `mod.symbol` inside
 * each test body keeps a missing export local instead of tumbling the file (E-019).
 */
const mod = await import("@/lib/clientes/clienteCache");

// Real v4 UUIDs (RFC 9562 version/variant nibbles): Zod 4.3.6's `z.string().uuid()`
// rejects the all-zero placeholder shape (version nibble 0). Only matters for the
// values that actually go through `clienteOptionSchema` below (`sanitizeClienteOptions`),
// but kept real throughout for consistency.
const UUID_1 = "7e027676-48e3-492a-9636-e979dcdbc42f";
const UUID_2 = "5b86a642-8092-406c-9d35-f7e91058de63";
const UUID_3 = "b0eda0f8-9d82-4a84-8590-60c819fe5b24";

function clienteConSaldo(overrides: Partial<IClienteConSaldo> = {}): IClienteConSaldo {
  return {
    id: UUID_1,
    nombre: "Ana Pérez",
    descripcion: "Cliente frecuente",
    direccion: "Calle Falsa 123",
    telefono: "55551234",
    negocioId: UUID_2,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
    saldo: 42.5,
    ...overrides,
  };
}

function opt(overrides: Partial<IClienteOption> = {}): IClienteOption {
  return {
    id: UUID_1,
    nombre: "Ana Pérez",
    telefono: null,
    saldo: 0,
    ...overrides,
  };
}

describe("toClienteOption", () => {
  it("projects down to exactly the four fields id, nombre, telefono, saldo", () => {
    const result = mod.toClienteOption(clienteConSaldo());
    expect(result).toEqual({
      id: UUID_1,
      nombre: "Ana Pérez",
      telefono: "55551234",
      saldo: 42.5,
    });
    // No leakage of descripcion, direccion, negocioId or timestamps (client-localstorage-schema rule).
    expect(Object.keys(result).sort()).toEqual(["id", "nombre", "saldo", "telefono"]);
  });
});

describe("rememberClientes", () => {
  it("puts incoming at the front, in the order given", () => {
    const current = [opt({ id: "a", nombre: "A" })];
    const incoming = [opt({ id: "b", nombre: "B" }), opt({ id: "c", nombre: "C" })];
    const result = mod.rememberClientes(current, incoming, 10);
    expect(result.map((o) => o.id)).toEqual(["b", "c", "a"]);
  });

  it("drops an earlier duplicate by id — the incoming copy wins (refreshed saldo replaces stale)", () => {
    const current = [opt({ id: "a", saldo: 10 })];
    const incoming = [opt({ id: "a", saldo: 99 })];
    const result = mod.rememberClientes(current, incoming, 10);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(opt({ id: "a", saldo: 99 }));
  });

  it("truncates to size, keeping the front (most recent) entries", () => {
    const current = [opt({ id: "a" }), opt({ id: "b" }), opt({ id: "c" })];
    const incoming = [opt({ id: "d" }), opt({ id: "e" })];
    const result = mod.rememberClientes(current, incoming, 3);
    expect(result.map((o) => o.id)).toEqual(["d", "e", "a"]);
  });

  it("mutates neither argument", () => {
    const current = [opt({ id: "a" })];
    const incoming = [opt({ id: "b" })];
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const incomingSnapshot = JSON.parse(JSON.stringify(incoming));
    mod.rememberClientes(current, incoming, 10);
    expect(current).toEqual(currentSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it("a duplicate id WITHIN incoming keeps the FIRST occurrence — incoming's own order is the contract", () => {
    // Edge case found by the implementer while implementing. Two rows for the same
    // id inside `incoming` itself: the earlier one must survive, not the later one.
    const current: ReturnType<typeof opt>[] = [];
    const incoming = [
      opt({ id: "dup", saldo: 1 }),
      opt({ id: "dup", saldo: 2 }),
    ];
    const result = mod.rememberClientes(current, incoming, 10);
    expect(result).toEqual([opt({ id: "dup", saldo: 1 })]);
  });

  it("size <= 0 yields an empty list, regardless of how much there is to remember", () => {
    const current = [opt({ id: "a" })];
    const incoming = [opt({ id: "b" }), opt({ id: "c" })];
    expect(mod.rememberClientes(current, incoming, 0)).toEqual([]);
    expect(mod.rememberClientes(current, incoming, -1)).toEqual([]);
  });
});

describe("sanitizeClienteOptions", () => {
  it("returns [] when value is not an array", () => {
    expect(mod.sanitizeClienteOptions("not-an-array", 10)).toEqual([]);
    expect(mod.sanitizeClienteOptions({ options: [] }, 10)).toEqual([]);
    expect(mod.sanitizeClienteOptions(null, 10)).toEqual([]);
    expect(mod.sanitizeClienteOptions(undefined, 10)).toEqual([]);
  });

  it("keeps only the elements that parse against clienteOptionSchema", () => {
    const valid = opt({ id: UUID_2 });
    const invalidMissingSaldo = { id: UUID_3, nombre: "X", telefono: null };
    const invalidBadId = { id: "not-a-uuid", nombre: "Y", telefono: null, saldo: 1 };
    const result = mod.sanitizeClienteOptions(
      [valid, invalidMissingSaldo, invalidBadId],
      10,
    );
    expect(result).toEqual([valid]);
  });

  it("truncates the sanitized result to size", () => {
    const options = [
      opt({ id: UUID_1 }),
      opt({ id: UUID_2 }),
      opt({ id: UUID_3 }),
    ];
    const result = mod.sanitizeClienteOptions(options, 2);
    expect(result).toHaveLength(2);
  });

  it("returns [] for an empty array", () => {
    expect(mod.sanitizeClienteOptions([], 10)).toEqual([]);
  });
});
