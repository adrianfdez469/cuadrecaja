import { describe, it, expect } from "vitest";

/**
 * F-032, ADR 0113, contract § 3.2, § 3.3, § 3.4, § 9.1 (H1) — the asymmetry that is the
 * whole point of the amendment: WRITE schemas reject a name carrying control
 * characters, READ schemas do not. Refining the read models would make a row written
 * before the bound existed unreadable — `reloadSales`/`clienteConSaldoSchema` would
 * start failing to parse rows that are otherwise perfectly fine.
 *
 * Deliberately asserted TOGETHER, in one place, the way the contract's own H1 checklist
 * puts it: "Las cuatro afirmaciones juntas, o la asimetría deliberada entre entrada y
 * lectura se pierde en la primera 'limpieza' que alguien haga."
 *
 * Dynamic top-level `await import`: `createClienteSchema`'s `.refine` and
 * `ventaSchema.clienteNombre` do not exist until the `implementer` adds them (E-019).
 * `clienteSchema` is untouched by this feature but is imported dynamically alongside
 * its sibling for consistency and because it comes from the same module.
 */
const { createClienteSchema, updateClienteSchema, clienteSchema } =
  await import("@/schemas/cliente");
const { ventaSchema } = await import("@/schemas/venta");
const { multimonedaExtrasSchema } = await import("@/schemas/pago");
const { CONTROL_CHARACTERS_MESSAGE } = await import("@/utils/printableText");

// The concrete "cash drawer kick" sequence from the dossier's own finding.
const KICK_SEQUENCE = "Ana\x1Bp\x00\x19\xFA";

// zod 4's uuid() enforces the RFC 4122 version/variant nibbles, so an all-repeated-digit
// placeholder like "11111111-1111-1111-1111-111111111111" fails to parse. crypto.randomUUID()
// is the simplest way to get a value the schema actually accepts.
const validVentaBase = () => ({
  id: crypto.randomUUID(),
  createdAt: new Date("2026-01-01"),
  total: 1000,
  totalcash: 1000,
  totaltransfer: 0,
  tiendaId: crypto.randomUUID(),
  usuarioId: crypto.randomUUID(),
  cierrePeriodoId: crypto.randomUUID(),
});

const validClienteRowBase = () => ({
  id: crypto.randomUUID(),
  negocioId: crypto.randomUUID(),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
});

describe("the four assertions of H1, together", () => {
  it("1) multimonedaExtrasSchema.clienteNombre (WRITE) REJECTS the kick sequence", () => {
    const result = multimonedaExtrasSchema.safeParse({
      monedaCobro: "CUP",
      pagosDetalle: [],
      vueltoDetalle: [],
      tasaSnapshot: {},
      clienteNombre: KICK_SEQUENCE,
    });
    expect(result.success).toBe(false);
  });

  it("2) createClienteSchema.nombre (WRITE) REJECTS the kick sequence, with the exact fixed message", () => {
    const result = createClienteSchema.safeParse({ nombre: KICK_SEQUENCE });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("nombre"));
      expect(issue?.message).toBe(CONTROL_CHARACTERS_MESSAGE);
    }
  });

  it("3) ventaSchema.clienteNombre (READ) ACCEPTS the kick sequence — refining it would break parsing a row written before the bound existed", () => {
    const result = ventaSchema.safeParse({
      ...validVentaBase(),
      clienteNombre: KICK_SEQUENCE,
    });
    expect(result.success).toBe(true);
  });

  it("4) clienteSchema.nombre (READ) ACCEPTS the kick sequence — same reasoning, and clienteConSaldoSchema (F-031) extends this schema", () => {
    const result = clienteSchema.safeParse({
      ...validClienteRowBase(),
      nombre: KICK_SEQUENCE,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateClienteSchema — the .refine survives .partial() (§ 3.4)", () => {
  it("rejects a control-character nombre when the field IS provided", () => {
    const result = updateClienteSchema.safeParse({ nombre: KICK_SEQUENCE });
    expect(result.success).toBe(false);
  });

  it("accepts an update that omits nombre entirely", () => {
    const result = updateClienteSchema.safeParse({ direccion: "Calle 1" });
    expect(result.success).toBe(true);
  });
});

describe("the duplicated 200-character bound stays in sync across the two files it lives in (ADR 0111: the pago.ts -> cliente.ts edge is forbidden)", () => {
  it("both multimonedaExtrasSchema.clienteNombre and createClienteSchema.nombre reject 201 clean characters", () => {
    const tooLong = "a".repeat(201);

    const fromSale = multimonedaExtrasSchema.safeParse({
      monedaCobro: "CUP",
      pagosDetalle: [],
      vueltoDetalle: [],
      tasaSnapshot: {},
      clienteNombre: tooLong,
    });
    const fromCliente = createClienteSchema.safeParse({ nombre: tooLong });

    expect(fromSale.success).toBe(false);
    expect(fromCliente.success).toBe(false);
  });

  it("the § 3.2 docstring names clienteSchema.nombre (the READ model) as the number to stay in step with, and that pre-existing (F-029) length bound also rejects 201 CLEAN characters — a length check, unrelated to the new control-character refine", () => {
    const tooLong = "a".repeat(201);
    const fromClienteRow = clienteSchema.safeParse({
      ...validClienteRowBase(),
      nombre: tooLong,
    });
    expect(fromClienteRow.success).toBe(false);
  });

  it("both accept exactly 200 clean characters", () => {
    const exactly200 = "a".repeat(200);

    const fromSale = multimonedaExtrasSchema.safeParse({
      monedaCobro: "CUP",
      pagosDetalle: [],
      vueltoDetalle: [],
      tasaSnapshot: {},
      clienteNombre: exactly200,
    });
    const fromCliente = createClienteSchema.safeParse({ nombre: exactly200 });

    expect(fromSale.success).toBe(true);
    expect(fromCliente.success).toBe(true);
  });
});
