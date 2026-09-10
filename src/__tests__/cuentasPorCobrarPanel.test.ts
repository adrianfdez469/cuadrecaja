import { describe, it, expect } from "vitest";
import { AGING_BUCKETS, MIN_OPEN_BALANCE_BASE } from "@/lib/cuentasPorCobrar/aging";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";

/**
 * F-033 — `src/lib/cuentasPorCobrar/panel.ts` (contract § 4, and design § 7 "En panel.ts —
 * cinco"). Covers testability symbols 6, 7, 8 of the contract's own list, plus the design's
 * panel.ts additions (numbered 16-20 in `.agents/designs/F-033.md` § 7) and `buildFiltroOpciones`
 * (added to contract § 4 and to the contract's own testability list as its item 16, alongside
 * `describeFiltros` as item 17 — the two numbering schemes collide by coincidence, not by
 * relation; every symbol from both lists that lives in this file is covered here regardless of
 * which number it carries).
 *
 * Dynamic import: the module does not exist until the `implementer` creates it (E-019,
 * same idiom as the rest of this suite).
 */
const { withAging, filterByBucket, buildDeudorRows, buildFiltroOpciones } = await import(
  "@/lib/cuentasPorCobrar/panel"
);
const {
  AGING_BUCKET_OPTIONS,
  formatAntiguedadDias,
  sumEquivalenteBase,
  describeAbono,
  buildMovimientoRows,
} = await import("@/lib/cuentasPorCobrar/panel");

const AT = new Date("2026-06-15T00:00:00.000Z");
const DAY_MS = 86_400_000;
const dateDaysBefore = (dias: number) => new Date(AT.getTime() - dias * DAY_MS);

function cuentaInput(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: crypto.randomUUID(),
    ventaId: crypto.randomUUID(),
    clienteId: crypto.randomUUID(),
    tiendaId: crypto.randomUUID(),
    tiendaNombre: "Tienda Centro",
    fechaVenta: dateDaysBefore(0),
    montoOriginal: 1000,
    saldoPendiente: 1000,
    settledAt: null,
    monedaDeudaCode: null,
    montoDeudaMonedaOriginal: null,
    ...over,
  };
}

describe("withAging — dias and bucket measured ONLY against `at`, never Date.now()", () => {
  it("attaches dias=daysOutstanding(fechaVenta, at) and its bucket", () => {
    const cuentas = [cuentaInput({ fechaVenta: dateDaysBefore(45) })];
    const [row] = withAging(cuentas, AT);
    expect(row.dias).toBe(45);
    expect(row.bucket).toBe("31-60");
  });

  it("is reproducible: the SAME `at`, called at two different real moments, gives the same result", () => {
    const cuentas = [cuentaInput({ fechaVenta: dateDaysBefore(91) })];
    const first = withAging(cuentas, AT)[0];
    // Simulate "later" by simply calling again — a function that secretly reads
    // Date.now() would only be caught by this if real time had passed, which is why the
    // `at` parameter is what's asserted directly above; this call is the sibling of that
    // assertion, re-run against the same input to rule out any incidental clock read.
    const second = withAging(cuentas, AT)[0];
    expect(second.dias).toBe(first.dias);
    expect(second.bucket).toBe(first.bucket);
    expect(first.bucket).toBe("91+");
  });

  it("preserves every input field, only adding dias and bucket", () => {
    const input = cuentaInput({ saldoPendiente: 250 });
    const [row] = withAging([input], AT);
    expect(row.id).toBe(input.id);
    expect(row.saldoPendiente).toBe(250);
  });
});

describe("filterByBucket — criterion 2's exact boundaries (30 / 45 / 61 days)", () => {
  const cuentas = withAging(
    [
      cuentaInput({ id: "cuenta-30", fechaVenta: dateDaysBefore(30) }),
      cuentaInput({ id: "cuenta-45", fechaVenta: dateDaysBefore(45) }),
      cuentaInput({ id: "cuenta-61", fechaVenta: dateDaysBefore(61) }),
    ],
    AT,
  );

  it("'31-60' returns ONLY the 45-day account — not the 30-day one, not the 61-day one", () => {
    const result = filterByBucket(cuentas, "31-60");
    expect(result.map((c) => c.id)).toEqual(["cuenta-45"]);
  });

  it("the 30-day account lands in 0-30 (a filter with no floor would wrongly admit it into 31-60)", () => {
    const result = filterByBucket(cuentas, "0-30");
    expect(result.map((c) => c.id)).toEqual(["cuenta-30"]);
  });

  it("the 61-day account lands in 61-90 (a filter with no ceiling would wrongly admit it into 31-60)", () => {
    const result = filterByBucket(cuentas, "61-90");
    expect(result.map((c) => c.id)).toEqual(["cuenta-61"]);
  });

  it("a null bucket keeps every account", () => {
    const result = filterByBucket(cuentas, null);
    expect(result).toHaveLength(3);
  });
});

describe("AGING_BUCKET_OPTIONS — derived from AGING_BUCKETS, never restated (E-014)", () => {
  it("has the same length and the same bucket values, in the same order", () => {
    expect(AGING_BUCKET_OPTIONS).toHaveLength(AGING_BUCKETS.length);
    expect(AGING_BUCKET_OPTIONS.map((o) => o.value)).toEqual(
      AGING_BUCKETS.map((b) => b.bucket),
    );
  });

  it("labels today's four brackets exactly", () => {
    expect(AGING_BUCKET_OPTIONS.map((o) => o.label)).toEqual([
      "0-30 días",
      "31-60 días",
      "61-90 días",
      "91+ días",
    ]);
  });
});

describe("formatAntiguedadDias", () => {
  it.each([
    [-1, "Hoy"],
    [0, "Hoy"],
    [1, "1 día"],
    [2, "2 días"],
    [30, "30 días"],
    [45, "45 días"],
    [61, "61 días"],
    [112, "112 días"],
  ])("formatAntiguedadDias(%p) -> %p", (dias, expected) => {
    expect(formatAntiguedadDias(dias)).toBe(expected);
  });
});

function pagoLinea(over: Partial<IPagoLinea> = {}): IPagoLinea {
  return {
    tipo: "cash",
    moneda: "CUP",
    monto: 1,
    equivalenteBase: 1,
    ...over,
  };
}

describe("sumEquivalenteBase", () => {
  it("returns 0 for an empty array", () => {
    expect(sumEquivalenteBase([])).toBe(0);
  });

  it("returns the single line's equivalenteBase", () => {
    expect(sumEquivalenteBase([pagoLinea({ equivalenteBase: 400 })])).toBe(400);
  });

  it("sums and rounds to two decimals (0.1 + 0.2 -> 0.3, not 0.30000000000000004)", () => {
    expect(
      sumEquivalenteBase([
        pagoLinea({ equivalenteBase: 0.1 }),
        pagoLinea({ equivalenteBase: 0.2 }),
      ]),
    ).toBe(0.3);
  });
});

describe("describeAbono — mirrors decision guard 8 letter for letter (contract worked examples)", () => {
  it.each([
    [1000, 0, "VACIO", 0, 0],
    [1000, 400, "PARCIAL", 600, 0],
    [600, 600, "SALDA", 0, 0],
    [500, 500, "SALDA", 0, 0], // the limit is ACCEPTED, not EXCEDE
    [500, 700, "EXCEDE", 0, 200],
    [12000, 12000, "SALDA", 0, 0],
    [12000, 6000, "PARCIAL", 6000, 0],
    [300, 700, "EXCEDE", 0, 400],
  ])(
    "describeAbono(saldo=%p, monto=%p) -> %p (restante %p, exceso %p)",
    (saldoPendiente, montoBase, estado, restante, exceso) => {
      const result = describeAbono(saldoPendiente, montoBase);
      expect(result.estado).toBe(estado);
      expect(result.restante).toBe(restante);
      expect(result.exceso).toBe(exceso);
    },
  );

  it("uses MIN_OPEN_BALANCE_BASE as its tolerance, not a hardcoded number", () => {
    // saldoPendiente 500, montoBase exactly saldoPendiente + MIN_OPEN_BALANCE_BASE: still SALDA
    const atTheLimit = describeAbono(500, 500 + MIN_OPEN_BALANCE_BASE);
    expect(atTheLimit.estado).toBe("SALDA");
    // one cent more: EXCEDE
    const overTheLimit = describeAbono(500, 500 + MIN_OPEN_BALANCE_BASE + 0.01);
    expect(overTheLimit.estado).toBe("EXCEDE");
  });
});

function cuentaDetalle(over: {
  id: string;
  tiendaNombre?: string;
  fechaVenta?: Date;
  movimientos: Array<{
    id: string;
    tipo: ITipoMovimientoCuentaPorCobrar;
    monto: number;
    fecha: Date;
    motivo?: string | null;
    revierteId?: string | null;
    usuarioNombre?: string | null;
  }>;
}) {
  return {
    id: over.id,
    tiendaNombre: over.tiendaNombre ?? "Tienda Centro",
    fechaVenta: over.fechaVenta ?? dateDaysBefore(10),
    // Each row mirrors movimientoCuentaPorCobrarConAutorSchema (contract § 2): every
    // required field of the base ledger row, plus the projected author name.
    movimientos: over.movimientos.map((m) => ({
      cuentaPorCobrarId: over.id,
      createdAt: m.fecha,
      usuarioNombre: null,
      motivo: null,
      revierteId: null,
      ...m,
    })),
  };
}

/**
 * IMPORTANT for whoever next touches this describe block: `buildMovimientoRows` sorts with
 * `b.fecha.getTime() - a.fecha.getTime()`, and `Array.prototype.sort` NEVER INVOKES ITS
 * COMPARATOR for an array of 0 or 1 elements. Every test below therefore uses AT LEAST TWO
 * movimientos on purpose — a single-movimiento fixture would never execute that comparator at
 * all, and would stay green even if `fecha` stopped being usable as a `Date` (see the real
 * incident this protects against: QA found a 500 on any deudor with 2+ movimientos, caused by
 * `src/services/cuentasPorCobrarService.ts` not parsing dates through its response schema —
 * `cuentasPorCobrarServiceDates.test.ts` covers that boundary; this file only ever hands
 * `buildMovimientoRows` real `Date` objects, by design, since that function's own contract
 * requires them — it is not this function's job to survive a caller that violates its type).
 */
describe("buildMovimientoRows — the ledger flattened across every account of a deudor", () => {
  it("marks the original ABONO as `revertido: true` and the REVERSION_ABONO as `esReversion: true`", () => {
    const cuenta = cuentaDetalle({
      id: "cuenta-1",
      movimientos: [
        { id: "m1", tipo: "ABONO", monto: 400, fecha: dateDaysBefore(5) },
        {
          id: "m2",
          tipo: "REVERSION_ABONO",
          monto: 400,
          fecha: dateDaysBefore(1),
          revierteId: "m1",
        },
      ],
    });
    const rows = buildMovimientoRows([cuenta]);
    const abono = rows.find((r) => r.id === "m1")!;
    const reversion = rows.find((r) => r.id === "m2")!;
    expect(abono.revertido).toBe(true);
    expect(abono.esReversion).toBe(false);
    expect(reversion.esReversion).toBe(true);
  });

  it("does NOT mark an ABONO as reverted when the matching revierteId belongs to a DIFFERENT account", () => {
    const cuentaX = cuentaDetalle({
      id: "cuenta-x",
      movimientos: [{ id: "dup", tipo: "ABONO", monto: 400, fecha: dateDaysBefore(5) }],
    });
    const cuentaY = cuentaDetalle({
      id: "cuenta-y",
      movimientos: [
        {
          id: "rev",
          tipo: "REVERSION_ABONO",
          monto: 400,
          fecha: dateDaysBefore(1),
          revierteId: "dup", // same string id as cuentaX's ABONO, but a DIFFERENT account
        },
      ],
    });
    const rows = buildMovimientoRows([cuentaX, cuentaY]);
    const abonoEnX = rows.find((r) => r.cuentaId === "cuenta-x" && r.id === "dup")!;
    expect(abonoEnX.revertido).toBe(false);
  });

  it("orders by fecha DESCENDING across accounts, tie-broken by id ASCENDING", () => {
    const sameFecha = dateDaysBefore(3);
    const cuentaX = cuentaDetalle({
      id: "cuenta-x",
      movimientos: [{ id: "z-row", tipo: "ABONO", monto: 100, fecha: sameFecha }],
    });
    const cuentaY = cuentaDetalle({
      id: "cuenta-y",
      movimientos: [
        { id: "a-row", tipo: "ABONO", monto: 200, fecha: sameFecha },
        { id: "newest", tipo: "ABONO", monto: 300, fecha: dateDaysBefore(1) },
      ],
    });
    const rows = buildMovimientoRows([cuentaX, cuentaY]);
    expect(rows.map((r) => r.id)).toEqual(["newest", "a-row", "z-row"]);
  });

  it("carries each row's own account's tiendaNombre and fechaVenta (ventaFecha)", () => {
    const fechaVentaX = dateDaysBefore(20);
    const cuentaX = cuentaDetalle({
      id: "cuenta-x",
      tiendaNombre: "Tienda Norte",
      fechaVenta: fechaVentaX,
      movimientos: [{ id: "m1", tipo: "ABONO", monto: 100, fecha: dateDaysBefore(2) }],
    });
    const [row] = buildMovimientoRows([cuentaX]);
    expect(row.tiendaNombre).toBe("Tienda Norte");
    expect(row.ventaFecha).toEqual(fechaVentaX);
    expect(row.cuentaId).toBe("cuenta-x");
  });

  it("copies usuarioNombre through UNCHANGED — string or null — never synthesizing a placeholder here", () => {
    // "Sin autor registrado" (the null-author placeholder) is screen copy, painted by the
    // component from a null usuarioNombre — it is NOT produced by this pure function, so a
    // null must come back as null, not as that string or any other stand-in.
    const cuentaConAutor = cuentaDetalle({
      id: "cuenta-con-autor",
      movimientos: [
        { id: "m1", tipo: "ABONO", monto: 100, fecha: dateDaysBefore(2), usuarioNombre: "Ana Pérez" },
      ],
    });
    const cuentaSinAutor = cuentaDetalle({
      id: "cuenta-sin-autor",
      movimientos: [
        { id: "m2", tipo: "ABONO", monto: 100, fecha: dateDaysBefore(2), usuarioNombre: null },
      ],
    });
    const [conAutor] = buildMovimientoRows([cuentaConAutor]);
    const [sinAutor] = buildMovimientoRows([cuentaSinAutor]);
    // toMatchObject, not toEqual (coordinator's instruction): this field set already changed
    // once in this feature and will again — a full-object equality would turn any unrelated
    // new field into a false red instead of signalling an actual defect.
    expect(conAutor).toMatchObject({ usuarioNombre: "Ana Pérez" });
    expect(sinAutor).toMatchObject({ usuarioNombre: null });
    expect(sinAutor.usuarioNombre).not.toBe("Sin autor registrado");
  });
});

function deudorInput(over: {
  clienteId?: string;
  clienteNombre: string;
  telefono?: string | null;
  cuentas: Array<{
    id: string;
    saldoPendiente: number;
    dias?: number;
    bucket?: string;
    tiendaId?: string;
    tiendaNombre?: string;
  }>;
  ultimoAbonoAt?: Date | null;
}) {
  const cuentas = withAging(
    over.cuentas.map((c) =>
      cuentaInput({
        id: c.id,
        saldoPendiente: c.saldoPendiente,
        fechaVenta: dateDaysBefore(c.dias ?? 10),
        ...(c.tiendaId !== undefined ? { tiendaId: c.tiendaId } : {}),
        ...(c.tiendaNombre !== undefined ? { tiendaNombre: c.tiendaNombre } : {}),
      }),
    ),
    AT,
  );
  return {
    clienteId: over.clienteId ?? crypto.randomUUID(),
    clienteNombre: over.clienteNombre,
    telefono: over.telefono ?? null,
    cuentas,
    ultimoAbonoAt: over.ultimoAbonoAt ?? null,
  };
}

describe("buildDeudorRows", () => {
  it("sums saldo only over accounts ABOVE MIN_OPEN_BALANCE_BASE — a rounding leftover does not count as open debt", () => {
    const deudor = deudorInput({
      clienteNombre: "Cliente Uno",
      cuentas: [
        { id: "c1", saldoPendiente: 400 },
        { id: "c2", saldoPendiente: 0.005 }, // below MIN_OPEN_BALANCE_BASE (0.01)
      ],
    });
    const [row] = buildDeudorRows([deudor]);
    expect(row.saldo).toBe(400);
  });

  it("estado is CON_DEUDA when at least one account survives the threshold", () => {
    const deudor = deudorInput({
      clienteNombre: "Con Deuda",
      cuentas: [{ id: "c1", saldoPendiente: 100 }],
    });
    expect(buildDeudorRows([deudor])[0].estado).toBe("CON_DEUDA");
  });

  it("estado is SALDADA when every account is at or below the threshold (or there are none)", () => {
    const deudor = deudorInput({
      clienteNombre: "Saldada",
      cuentas: [{ id: "c1", saldoPendiente: 0 }],
    });
    expect(buildDeudorRows([deudor])[0].estado).toBe("SALDADA");
  });

  it("antiguedadDias/antiguedadBucket is the HIGHEST among the accounts, not the first or the sum", () => {
    const deudor = deudorInput({
      clienteNombre: "Mixta",
      cuentas: [
        { id: "reciente", saldoPendiente: 100, dias: 10 },
        { id: "vieja", saldoPendiente: 100, dias: 91 },
      ],
    });
    const row = buildDeudorRows([deudor])[0];
    expect(row.antiguedadDias).toBe(91);
    expect(row.antiguedadBucket).toBe("91+");
  });

  it("ultimoAbonoAt is echoed through unchanged, including null", () => {
    const conAbono = deudorInput({
      clienteNombre: "Con Abono",
      cuentas: [{ id: "c1", saldoPendiente: 100 }],
      ultimoAbonoAt: dateDaysBefore(3),
    });
    const sinAbono = deudorInput({
      clienteNombre: "Sin Abono",
      cuentas: [{ id: "c2", saldoPendiente: 100 }],
      ultimoAbonoAt: null,
    });
    const rows = buildDeudorRows([conAbono, sinAbono]);
    expect(rows.find((r) => r.clienteNombre === "Con Abono")!.ultimoAbonoAt).toEqual(
      dateDaysBefore(3),
    );
    expect(rows.find((r) => r.clienteNombre === "Sin Abono")!.ultimoAbonoAt).toBeNull();
  });

  it("sorts by saldo DESCENDING, ties broken by clienteNombre ASCENDING", () => {
    const carla = deudorInput({
      clienteNombre: "Carla",
      cuentas: [{ id: "c-carla", saldoPendiente: 500 }],
    });
    const ana = deudorInput({
      clienteNombre: "Ana",
      cuentas: [{ id: "c-ana", saldoPendiente: 300 }],
    });
    const beto = deudorInput({
      clienteNombre: "Beto",
      cuentas: [{ id: "c-beto", saldoPendiente: 300 }],
    });
    const rows = buildDeudorRows([ana, carla, beto]); // deliberately unsorted input
    expect(rows.map((r) => r.clienteNombre)).toEqual(["Carla", "Ana", "Beto"]);
  });
});

describe("buildFiltroOpciones — the Deudor/Tienda filter options (contract § 4, testability item 16)", () => {
  it("deduplicates tiendas by tiendaId, keeping the FIRST tiendaNombre seen, sorted by name", () => {
    // buildDeudorRows sorts by saldo DESCENDING before this test hands its output to
    // buildFiltroOpciones (see the "buildDeudorRows" describe above) — so "first seen" is
    // controlled here by giving deudorUno an unambiguously higher saldo than deudorDos, not by
    // the order these two are written in below.
    const deudorUno = deudorInput({
      clienteNombre: "Deudor Uno",
      cuentas: [
        { id: "c1", saldoPendiente: 500, tiendaId: "t-b", tiendaNombre: "Tienda B" },
      ],
    });
    const deudorDos = deudorInput({
      clienteNombre: "Deudor Dos",
      cuentas: [
        // Same tiendaId as deudorUno's account, but with a DIFFERENT name — deudorUno's row
        // sorts first (higher saldo), so its "Tienda B" must win over this one.
        { id: "c2", saldoPendiente: 50, tiendaId: "t-b", tiendaNombre: "Tienda B (renombrada)" },
        { id: "c3", saldoPendiente: 50, tiendaId: "t-a", tiendaNombre: "Tienda A" },
      ],
    });
    const rows = buildDeudorRows([deudorUno, deudorDos]);
    expect(rows.map((r) => r.clienteNombre)).toEqual(["Deudor Uno", "Deudor Dos"]); // sanity: order assumed above
    const { tiendas } = buildFiltroOpciones(rows);
    expect(tiendas).toEqual([
      { id: "t-a", nombre: "Tienda A" },
      { id: "t-b", nombre: "Tienda B" },
    ]);
  });

  it("lists deudores sorted by name, and a deudor with NO open accounts still contributes its own option", () => {
    const carla = deudorInput({
      clienteId: "cliente-carla",
      clienteNombre: "Carla",
      cuentas: [{ id: "c-carla", saldoPendiente: 100, tiendaId: "t1", tiendaNombre: "Tienda Uno" }],
    });
    const anaSaldada = deudorInput({
      clienteId: "cliente-ana",
      clienteNombre: "Ana",
      cuentas: [], // fully settled / no live accounts — must still appear as a filter option
    });
    const rows = buildDeudorRows([carla, anaSaldada]);
    const { deudores, tiendas } = buildFiltroOpciones(rows);
    expect(deudores).toEqual([
      { id: "cliente-ana", nombre: "Ana" },
      { id: "cliente-carla", nombre: "Carla" },
    ]);
    // Ana has no accounts at all: she names herself as a Deudor option, but contributes
    // NOTHING to the Tienda universe — there is no store to derive from an empty account list.
    expect(tiendas).toEqual([{ id: "t1", nombre: "Tienda Uno" }]);
  });

  it("returns two empty lists for no deudores at all", () => {
    expect(buildFiltroOpciones([])).toEqual({ deudores: [], tiendas: [] });
  });

  it("two deudores sharing the SAME store give ONE tienda option, not two — a missing dedupe would double it", () => {
    const deudorUno = deudorInput({
      clienteNombre: "Deudor Uno",
      cuentas: [{ id: "c1", saldoPendiente: 500, tiendaId: "t-mismo", tiendaNombre: "Tienda Compartida" }],
    });
    const deudorDos = deudorInput({
      clienteNombre: "Deudor Dos",
      cuentas: [{ id: "c2", saldoPendiente: 300, tiendaId: "t-mismo", tiendaNombre: "Tienda Compartida" }],
    });
    const rows = buildDeudorRows([deudorUno, deudorDos]);
    const { tiendas } = buildFiltroOpciones(rows);
    expect(tiendas).toEqual([{ id: "t-mismo", nombre: "Tienda Compartida" }]);
  });

  it("the result does NOT depend on the input order — the same deudores, fed in reverse, give the same options", () => {
    const deudorUno = deudorInput({
      clienteId: "cliente-1",
      clienteNombre: "Ana",
      cuentas: [{ id: "c1", saldoPendiente: 500, tiendaId: "t-1", tiendaNombre: "Tienda Uno" }],
    });
    const deudorDos = deudorInput({
      clienteId: "cliente-2",
      clienteNombre: "Beto",
      cuentas: [{ id: "c2", saldoPendiente: 300, tiendaId: "t-2", tiendaNombre: "Tienda Dos" }],
    });
    const forward = buildFiltroOpciones(buildDeudorRows([deudorUno, deudorDos]));
    const backward = buildFiltroOpciones(buildDeudorRows([deudorDos, deudorUno]));
    expect(forward).toEqual(backward);
  });
});
