import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * F-033 — REGRESSION for a bug QA found by executing, that the rest of this suite did not
 * catch: `src/services/cuentasPorCobrarService.ts` returned `response.data` VERBATIM instead
 * of parsing it through the response schemas of `src/schemas/cuentasPorCobrarPanel.ts`. Every
 * one of those schemas declares its date fields with `z.coerce.date()` — but coercion only
 * happens if something actually calls `.parse()`. Skipping that step means `fecha`,
 * `createdAt`, `settledAt`, `ultimoAbonoAt` and `at` all arrive as whatever `JSON.parse` (inside
 * axios) produces for a date: a plain ISO STRING, never a `Date`.
 *
 * The visible failure: `buildMovimientoRows` (`src/lib/cuentasPorCobrar/panel.ts`) sorts with
 * `b.fecha.getTime() - a.fecha.getTime()`. A string has no `.getTime()`, so the deudor detail
 * page threw a 500 for any deudor with movimientos in its ledger.
 *
 * WHY THE EXISTING TESTS OF `buildMovimientoRows` (`cuentasPorCobrarPanel.test.ts`) NEVER CAUGHT
 * THIS — this is E-008 in its cleanest form, and worth spelling out so the next person who
 * touches that file doesn't reintroduce the gap:
 *
 *   1. `Array.prototype.sort` NEVER INVOKES ITS COMPARATOR for an array of 0 or 1 elements.
 *      A test built around a single movimiento — the smallest, most "obvious" fixture to
 *      reach for — never executes the line that breaks, no matter how broken it is.
 *   2. Every fixture in `cuentasPorCobrarPanel.test.ts` builds its `fecha` with `new Date(...)`
 *      directly, because that's the natural thing to do by hand. That is exactly the ONE
 *      thing the real request/response cycle never gives you: a `Date` only exists after
 *      something parses the JSON string the network actually carried. A pure-function test
 *      that only ever hands `buildMovimientoRows` real `Date` objects is therefore
 *      STRUCTURALLY UNABLE to discriminate this bug, however many cases it covers — the type
 *      loss happens one layer up, at the service boundary this file exists to cover.
 *
 * So: the answer to "which datum would have failed this?" is "two or more movimientos, dated
 * as the wire actually delivers them" — and neither half alone is enough.
 *
 * `@/lib/axiosClient`'s default export is mocked here (the external dependency, never the code
 * under test). Every fixture below hands back dates as plain ISO strings — deliberately never
 * as `Date` instances — because that is what `axios` really resolves a JSON body's dates as.
 * Only a service that runs the response through its Zod schema turns them into real `Date`s;
 * this file asserts on the OUTPUT of the real, imported service functions, not on the schemas
 * in isolation (parsing a schema directly proves the schema coerces — it says nothing about
 * whether the service actually calls it, which is precisely what broke).
 *
 * Written against the contract (`.agents/specs/F-033.md` § 2 for the schemas, § 7 for the
 * service's six exported functions), not against the implementer's fix — which is landing in
 * parallel, in `src/services/cuentasPorCobrarService.ts`, which this file never reads. Red here
 * until that fix lands is expected.
 */

const get = vi.fn();
const post = vi.fn();

vi.mock("@/lib/axiosClient", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
  },
}));

const {
  getCuentasPorCobrar,
  getCuentaPorCobrar,
  getDeudorDetalle,
  registrarAbono,
  perdonarDeuda,
  revertirAbono,
} = await import("@/services/cuentasPorCobrarService");

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

const cuentaId = crypto.randomUUID();
const ventaId = crypto.randomUUID();
const tiendaId = crypto.randomUUID();
const clienteId = crypto.randomUUID();
const cierrePeriodoAbiertoId = crypto.randomUUID();

/** A cuentaAbiertaSchema-shaped row exactly AS THE WIRE DELIVERS IT: every date is a string. */
function rawCuentaAbierta(over: Record<string, unknown> = {}) {
  return {
    id: cuentaId,
    ventaId,
    tiendaId,
    tiendaNombre: "Tienda Centro",
    fechaVenta: "2026-01-10T00:00:00.000Z",
    montoOriginal: 1000,
    saldoPendiente: 600,
    settledAt: null,
    monedaDeudaCode: null,
    montoDeudaMonedaOriginal: null,
    dias: 10,
    bucket: "0-30",
    cierrePeriodoAbiertoId,
    ...over,
  };
}

/** A movimientoCuentaPorCobrarConAutorSchema-shaped row, dates as strings. */
function rawMovimiento(over: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    cuentaPorCobrarId: cuentaId,
    tipo: "ABONO",
    monto: 100,
    fecha: "2026-01-11T00:00:00.000Z",
    createdAt: "2026-01-11T00:00:00.000Z",
    usuarioNombre: null,
    ...over,
  };
}

describe("getDeudorDetalle — the EXACT scenario QA found: a deudor with TWO OR MORE movimientos, dates over the wire", () => {
  it("parses the response through its schema: every date field comes back a REAL Date, never a string", async () => {
    get.mockResolvedValue({
      data: {
        at: "2026-01-20T00:00:00.000Z",
        cliente: { id: clienteId, nombre: "Cliente Uno", telefono: null },
        saldo: 600,
        cuentas: [
          {
            ...rawCuentaAbierta(),
            clienteId,
            clienteNombre: "Cliente Uno",
            venta: null,
            // TWO movimientos, on purpose: with only one, buildMovimientoRows's sort would
            // never even run its comparator, and this exact bug would stay invisible.
            movimientos: [
              rawMovimiento({ fecha: "2026-01-11T00:00:00.000Z" }),
              rawMovimiento({ fecha: "2026-01-15T00:00:00.000Z" }),
            ],
          },
        ],
      },
    });

    const result = await getDeudorDetalle(clienteId);

    expect(result.at).toBeInstanceOf(Date);
    expect(result.cuentas).toHaveLength(1);
    const [cuenta] = result.cuentas;
    expect(cuenta.fechaVenta).toBeInstanceOf(Date);
    expect(cuenta.movimientos).toHaveLength(2);
    for (const movimiento of cuenta.movimientos) {
      expect(movimiento.fecha).toBeInstanceOf(Date);
      expect(movimiento.createdAt).toBeInstanceOf(Date);
    }
  });

  it("coerces settledAt too, when the account is settled (not just null)", async () => {
    get.mockResolvedValue({
      data: {
        at: "2026-01-20T00:00:00.000Z",
        cliente: { id: clienteId, nombre: "Cliente Uno", telefono: null },
        saldo: 0,
        cuentas: [
          {
            ...rawCuentaAbierta({ settledAt: "2026-01-18T00:00:00.000Z", saldoPendiente: 0 }),
            clienteId,
            clienteNombre: "Cliente Uno",
            venta: null,
            movimientos: [rawMovimiento(), rawMovimiento()],
          },
        ],
      },
    });

    const result = await getDeudorDetalle(clienteId);
    expect(result.cuentas[0].settledAt).toBeInstanceOf(Date);
  });
});

describe("getCuentaPorCobrar — same class of bug, the single-account detail endpoint", () => {
  it("returns fechaVenta, and every movimiento's fecha/createdAt, as real Dates", async () => {
    get.mockResolvedValue({
      data: {
        at: "2026-01-20T00:00:00.000Z",
        cuenta: {
          ...rawCuentaAbierta(),
          clienteId,
          clienteNombre: "Cliente Uno",
          movimientos: [
            rawMovimiento({ fecha: "2026-01-11T00:00:00.000Z" }),
            rawMovimiento({ fecha: "2026-01-15T00:00:00.000Z" }),
          ],
        },
      },
    });

    const result = await getCuentaPorCobrar(cuentaId);

    expect(result.at).toBeInstanceOf(Date);
    expect(result.cuenta.fechaVenta).toBeInstanceOf(Date);
    expect(result.cuenta.movimientos).toHaveLength(2);
    for (const movimiento of result.cuenta.movimientos) {
      expect(movimiento.fecha).toBeInstanceOf(Date);
      expect(movimiento.createdAt).toBeInstanceOf(Date);
    }
  });
});

describe("getCuentasPorCobrar — the panel's list endpoint, criterion 1's 'fecha del ultimo abono' column", () => {
  it("coerces the top-level 'at', each row's ultimoAbonoAt, and each account's fechaVenta", async () => {
    get.mockResolvedValue({
      data: {
        at: "2026-01-20T00:00:00.000Z",
        total: 1,
        data: [
          {
            clienteId,
            clienteNombre: "Cliente Uno",
            telefono: null,
            saldo: 600,
            cuentasAbiertas: 1,
            antiguedadDias: 10,
            antiguedadBucket: "0-30",
            ultimoAbonoAt: "2026-01-15T00:00:00.000Z",
            estado: "CON_DEUDA",
            cuentas: [rawCuentaAbierta()],
          },
        ],
      },
    });

    const result = await getCuentasPorCobrar({});

    expect(result.at).toBeInstanceOf(Date);
    const [row] = result.data;
    expect(row.ultimoAbonoAt).toBeInstanceOf(Date);
    expect(row.cuentas[0].fechaVenta).toBeInstanceOf(Date);
  });

  it("keeps ultimoAbonoAt as null when the deudor never paid — coercion must not turn a null into a Date", async () => {
    get.mockResolvedValue({
      data: {
        at: "2026-01-20T00:00:00.000Z",
        total: 1,
        data: [
          {
            clienteId,
            clienteNombre: "Cliente Uno",
            telefono: null,
            saldo: 600,
            cuentasAbiertas: 1,
            antiguedadDias: 10,
            antiguedadBucket: "0-30",
            ultimoAbonoAt: null,
            estado: "CON_DEUDA",
            cuentas: [rawCuentaAbierta()],
          },
        ],
      },
    });

    const result = await getCuentasPorCobrar({});
    expect(result.data[0].ultimoAbonoAt).toBeNull();
  });
});

describe("registrarAbono / perdonarDeuda / revertirAbono — settledAt is a date field on EVERY write response too", () => {
  const idempotencyKey = crypto.randomUUID();

  it("registrarAbono coerces settledAt to a real Date when the collection settles the account", async () => {
    post.mockResolvedValue({
      data: {
        movimientoId: crypto.randomUUID(),
        cuentaId,
        tipo: "ABONO",
        monto: 600,
        saldoPendiente: 0,
        settledAt: "2026-01-20T00:00:00.000Z",
      },
    });

    const result = await registrarAbono(
      cuentaId,
      { pagos: [{ tipo: "cash", moneda: "CUP", monto: 600 }] },
      idempotencyKey,
    );
    expect(result.settledAt).toBeInstanceOf(Date);
  });

  it("perdonarDeuda coerces settledAt too", async () => {
    post.mockResolvedValue({
      data: {
        movimientoId: crypto.randomUUID(),
        cuentaId,
        tipo: "CONDONACION",
        monto: 600,
        saldoPendiente: 0,
        settledAt: "2026-01-20T00:00:00.000Z",
      },
    });

    const result = await perdonarDeuda(cuentaId, {}, idempotencyKey);
    expect(result.settledAt).toBeInstanceOf(Date);
  });

  it("revertirAbono keeps settledAt as null (not a Date, not a string) when the account is live again", async () => {
    post.mockResolvedValue({
      data: {
        movimientoId: crypto.randomUUID(),
        cuentaId,
        tipo: "REVERSION_ABONO",
        monto: 600,
        saldoPendiente: 600,
        settledAt: null,
      },
    });

    const result = await revertirAbono(
      cuentaId,
      { movimientoId: crypto.randomUUID() },
      idempotencyKey,
    );
    expect(result.settledAt).toBeNull();
  });
});
