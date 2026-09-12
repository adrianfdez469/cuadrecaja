import { describe, it, expect } from "vitest";

/**
 * F-033, contract § 2.2, § 11.1 — `src/schemas/clienteSaldo.ts`.
 *
 * Namespace import: the module is new and may land with only some of its schemas
 * defined while `implementer` works in parallel (E-019).
 */
const schemas = await import("@/schemas/clienteSaldo");

// Real v4 UUIDs (RFC 9562 version/variant nibbles), not the all-zero placeholder:
// Zod 4.3.6's `z.string().uuid()` validates the version nibble and rejects
// `00000000-...` shaped strings (version nibble 0). Prisma generates v4, so this is
// what real rows look like — the fixture, not the schema, was wrong.
const VALID_UUID = "bab899d6-73bb-4eac-86df-ba3eda45045e";

function baseCliente() {
  return {
    id: VALID_UUID,
    nombre: "Ana Pérez",
    descripcion: null,
    direccion: null,
    telefono: null,
    negocioId: "bb6cc546-a6e0-4440-93ee-14d400c2b85d",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    deletedAt: null,
  };
}

describe("clienteConSaldoSchema", () => {
  it("accepts a cliente row with a numeric saldo", () => {
    const result = schemas.clienteConSaldoSchema.safeParse({
      ...baseCliente(),
      saldo: 125.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a row missing saldo", () => {
    const result = schemas.clienteConSaldoSchema.safeParse(baseCliente());
    expect(result.success).toBe(false);
  });

  it("rejects saldo as a string", () => {
    const result = schemas.clienteConSaldoSchema.safeParse({
      ...baseCliente(),
      saldo: "125.50",
    });
    expect(result.success).toBe(false);
  });
});

describe("clienteOptionSchema — the exact four fields the cache persists", () => {
  it("accepts the four documented fields, with telefono as an explicit null", () => {
    const result = schemas.clienteOptionSchema.safeParse({
      id: VALID_UUID,
      nombre: "Ana Pérez",
      telefono: null,
      saldo: 0,
    });
    expect(result.success).toBe(true);
  });

  it("accepts telefono as a present string", () => {
    const result = schemas.clienteOptionSchema.safeParse({
      id: VALID_UUID,
      nombre: "Ana Pérez",
      telefono: "55551234",
      saldo: 0,
    });
    expect(result.success).toBe(true);
  });

  it(
    "REJECTS an entry with the telefono key entirely absent — nullable() without " +
      "optional() means the key must always be present, which is exactly what " +
      "criterion 8 inspects in localStorage",
    () => {
      const result = schemas.clienteOptionSchema.safeParse({
        id: VALID_UUID,
        nombre: "Ana Pérez",
        saldo: 0,
      });
      expect(result.success).toBe(false);
    },
  );

  it("rejects a non-uuid id", () => {
    const result = schemas.clienteOptionSchema.safeParse({
      id: "not-a-uuid",
      nombre: "Ana Pérez",
      telefono: null,
      saldo: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric saldo", () => {
    const result = schemas.clienteOptionSchema.safeParse({
      id: VALID_UUID,
      nombre: "Ana Pérez",
      telefono: null,
      saldo: "0",
    });
    expect(result.success).toBe(false);
  });
});

describe("clienteUpsertResponseSchema", () => {
  it('accepts action: "CREATE" with a clienteConSaldo payload', () => {
    const result = schemas.clienteUpsertResponseSchema.safeParse({
      action: "CREATE",
      cliente: { ...baseCliente(), saldo: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts action: "REACTIVATE"', () => {
    const result = schemas.clienteUpsertResponseSchema.safeParse({
      action: "REACTIVATE",
      cliente: { ...baseCliente(), saldo: 0 },
    });
    expect(result.success).toBe(true);
  });

  it(
    'REJECTS action: "DUPLICATE" — that internal action never reaches this response ' +
      "shape: a POST duplicate is a 409 with a different body ({ error }), not this schema",
    () => {
      const result = schemas.clienteUpsertResponseSchema.safeParse({
        action: "DUPLICATE",
        cliente: { ...baseCliente(), saldo: 0 },
      });
      expect(result.success).toBe(false);
    },
  );
});

describe("clienteDeleteConflictSchema", () => {
  it("accepts the documented 409 body", () => {
    const result = schemas.clienteDeleteConflictSchema.safeParse({
      error: "No se puede eliminar el cliente: tiene un saldo pendiente de 1250.00",
      saldoPendiente: 1250,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a body missing saldoPendiente", () => {
    const result = schemas.clienteDeleteConflictSchema.safeParse({
      error: "algo",
    });
    expect(result.success).toBe(false);
  });
});

describe("CLIENTE_UPSERT_ACTIONS", () => {
  it("is exactly CREATE/REACTIVATE/DUPLICATE, in that order", () => {
    expect(schemas.CLIENTE_UPSERT_ACTIONS).toEqual([
      "CREATE",
      "REACTIVATE",
      "DUPLICATE",
    ]);
  });
});
