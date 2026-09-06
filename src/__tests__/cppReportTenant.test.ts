import { describe, it, expect, vi, beforeEach } from "vitest";
import { NEGOCIO_A, NEGOCIO_B, TENANT_ISOLATION_FIXTURE_ROWS } from "./fixtures/threeTenants";

/**
 * F-022 — `src/lib/reports/cpp-report.ts` (contract § 1.2, ADR 0083/0084/0085) and the new
 * constant `CPP_ENTRY_MOVEMENT_TYPES` (contract § 1.3, `@/constants/movimientos`).
 *
 * Criterion 5 for the three migrated functions: `analizarCPPTienda`, `detectarDesviacionesCPP`
 * and `migrarDatosHistoricosCPP` — the last one is the feature's ONLY write, so its `updateMany`
 * where and its `count !== 1` error handling get dedicated coverage.
 *
 * `productoTienda` and `movimientoStock` rows are extended from
 * `TENANT_ISOLATION_FIXTURE_ROWS`, adding only the CPP-specific fields these functions read
 * (`costo`, `existencia`, `producto.nombre`, `tipo`, `costoUnitario`…) — never touching the
 * shared fixture file or `MODEL_SCALAR_KEYS` (ADR 0085 forbids widening `TENANT_RELATION_PATH`
 * for `DiscountRule`, and the same paragraph forbids editing the fixture from this side of the
 * write boundary).
 *
 * `@/lib/prisma` is mocked. `findMany`/`updateMany` do REAL where-evaluation with a LOCAL
 * `matchesWhere` (contract § 5.1.2: `tenantIsolation.test.ts`'s evaluator does not understand
 * `{ gt: 0 }` — the one `cppProductosWhere` uses — so this file brings its own, not shared with
 * F-021's).
 */

const findManyProductoTienda = vi.fn();
const findManyMovimientoStock = vi.fn();
const updateManyMovimientoStock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    productoTienda: { findMany: findManyProductoTienda },
    movimientoStock: {
      findMany: findManyMovimientoStock,
      updateMany: updateManyMovimientoStock,
    },
  },
}));

const {
  cppProductosWhere,
  cppMovimientosSinCostoWhere,
  cppMovimientoUpdateWhere,
  analizarCPPTienda,
  detectarDesviacionesCPP,
  migrarDatosHistoricosCPP,
} = await import("@/lib/reports/cpp-report");

const { withTenantScope } = await import("@/lib/tenantScope");
const { CPP_ENTRY_MOVEMENT_TYPES } = await import("@/constants/movimientos");

beforeEach(() => {
  vi.clearAllMocks();
});

/* ------------------------------------------------------------------------------- */
/* A local where-evaluator: scalar equality (incl. `null`), `{ in: [...] }`,         */
/* `{ gt: number }` and one-hop relation nesting. The `gt` handler is the one         */
/* `tenantIsolation.test.ts` deliberately lacks (§ 5.1.2) — this file is its own.     */
/* ------------------------------------------------------------------------------- */

type WhereClause = Record<string, unknown>;
type FixtureRow = Record<string, unknown>;

function isInOperator(value: unknown): value is { in: readonly unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    Array.isArray((value as { in?: unknown }).in)
  );
}

function isGtOperator(value: unknown): value is { gt: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === 1 &&
    typeof (value as { gt?: unknown }).gt === "number"
  );
}

function isNestedClause(value: unknown): value is WhereClause {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchesWhere(row: FixtureRow, where: WhereClause): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === null) return row[key] === null;
    if (isInOperator(value)) return value.in.includes(row[key]);
    if (isGtOperator(value)) {
      return typeof row[key] === "number" && (row[key] as number) > value.gt;
    }
    if (isNestedClause(value)) {
      return matchesWhere((row[key] ?? {}) as FixtureRow, value);
    }
    return row[key] === value;
  });
}

describe("matchesWhere (local helper sanity, incl. the { gt: 0 } gap)", () => {
  it("matches { gt: 0 } against a positive number and rejects zero", () => {
    expect(matchesWhere({ existencia: 5 }, { existencia: { gt: 0 } })).toBe(true);
    expect(matchesWhere({ existencia: 0 }, { existencia: { gt: 0 } })).toBe(false);
  });
});

/* ------------------------------------------------------------------------------- */
/* CPP_ENTRY_MOVEMENT_TYPES                                                          */
/* ------------------------------------------------------------------------------- */

describe("CPP_ENTRY_MOVEMENT_TYPES", () => {
  it("is exactly the three inbound-with-cost movement types", () => {
    expect(CPP_ENTRY_MOVEMENT_TYPES).toEqual([
      "COMPRA",
      "TRASPASO_ENTRADA",
      "CONSIGNACION_ENTRADA",
    ]);
  });
});

/* ------------------------------------------------------------------------------- */
/* The three PURE where-builders (ADR 0085: withTenantScope, no hand-rolled path)    */
/* ------------------------------------------------------------------------------- */

describe("cppProductosWhere", () => {
  it("matches withTenantScope('productoTienda', { tiendaId, existencia: { gt: 0 } }, negocioId)", () => {
    const params = { negocioId: NEGOCIO_A, tiendaId: "t1" };
    expect(cppProductosWhere(params)).toEqual(
      withTenantScope("productoTienda", { tiendaId: "t1", existencia: { gt: 0 } }, NEGOCIO_A),
    );
  });
});

describe("cppMovimientosSinCostoWhere", () => {
  it("matches withTenantScope('movimientoStock', { tiendaId, tipo: { in: CPP_ENTRY_MOVEMENT_TYPES }, costoUnitario: null }, negocioId)", () => {
    const params = { negocioId: NEGOCIO_A, tiendaId: "t1" };
    expect(cppMovimientosSinCostoWhere(params)).toEqual(
      withTenantScope(
        "movimientoStock",
        { tiendaId: "t1", tipo: { in: CPP_ENTRY_MOVEMENT_TYPES }, costoUnitario: null },
        NEGOCIO_A,
      ),
    );
  });
});

describe("cppMovimientoUpdateWhere", () => {
  it("matches withTenantScope('movimientoStock', { id }, negocioId) — the guard on the feature's only write", () => {
    expect(cppMovimientoUpdateWhere({ negocioId: NEGOCIO_A, id: "mov-1" })).toEqual(
      withTenantScope("movimientoStock", { id: "mov-1" }, NEGOCIO_A),
    );
  });
});

/* ------------------------------------------------------------------------------- */
/* analizarCPPTienda / detectarDesviacionesCPP — criterion 5                         */
/* ------------------------------------------------------------------------------- */

const [ptBaseA, ptBaseB, ptBaseC] = TENANT_ISOLATION_FIXTURE_ROWS.productoTienda;
const CPP_TIENDA_ID = ptBaseA.tiendaId as string;

const PRODUCTO_TIENDA_CPP_ROWS = [
  { ...ptBaseA, id: "pt-a", costo: 100, existencia: 5, proveedor: null, producto: { nombre: "Producto Test" } },
  { ...ptBaseB, id: "pt-b", costo: 100, existencia: 5, proveedor: null, producto: { nombre: "Producto Test" } },
  { ...ptBaseC, id: "pt-c", costo: 999, existencia: 5, proveedor: null, producto: { nombre: "Producto Control" } },
  // Same tenant as A, but existencia is 0: must never appear either, regardless of tenant
  // (the { gt: 0 } clause this file's matchesWhere exists to enforce — § 5.1.2).
  { ...ptBaseA, id: "pt-a-sin-stock", costo: 100, existencia: 0, proveedor: null, producto: { nombre: "Sin stock" } },
];

function seedProductoTiendaCPP() {
  findManyProductoTienda.mockImplementation(
    async ({ where }: { where: WhereClause }) =>
      PRODUCTO_TIENDA_CPP_ROWS.filter((row) => matchesWhere(row, where)),
  );
}

describe("analizarCPPTienda", () => {
  it("returns exactly its own negocio's productos with stock (criterion 5): never the homonym, the control, or the zero-stock row", async () => {
    seedProductoTiendaCPP();
    findManyMovimientoStock.mockResolvedValue([]); // no historial needed for this assertion

    const result = await analizarCPPTienda({ negocioId: NEGOCIO_A, tiendaId: CPP_TIENDA_ID });

    expect(result.map((a) => a.productoId)).toEqual(["pt-a"]);
  });

  it("calls productoTienda.findMany with cppProductosWhere(params)", async () => {
    seedProductoTiendaCPP();
    findManyMovimientoStock.mockResolvedValue([]);

    await analizarCPPTienda({ negocioId: NEGOCIO_A, tiendaId: CPP_TIENDA_ID });

    expect(findManyProductoTienda).toHaveBeenCalledWith(
      expect.objectContaining({
        where: cppProductosWhere({ negocioId: NEGOCIO_A, tiendaId: CPP_TIENDA_ID }),
      }),
    );
  });

  it("returns [] out of tenant (ADR 0084)", async () => {
    seedProductoTiendaCPP();
    findManyMovimientoStock.mockResolvedValue([]);

    const result = await analizarCPPTienda({
      negocioId: "negocio-que-no-existe",
      tiendaId: CPP_TIENDA_ID,
    });

    expect(result).toEqual([]);
  });

  it("is symmetric: negocioId NEGOCIO_B, same tiendaId, returns only its own homonym row pt-b — never pt-a nor the control (closes the E-008 gap this fixture exists for)", async () => {
    seedProductoTiendaCPP();
    findManyMovimientoStock.mockResolvedValue([]);

    const result = await analizarCPPTienda({ negocioId: NEGOCIO_B, tiendaId: CPP_TIENDA_ID });

    expect(result.map((a) => a.productoId)).toEqual(["pt-b"]);
  });
});

describe("detectarDesviacionesCPP", () => {
  /** costoActual (100) far from costoUnitario (40) -> a real deviation, well above the 10% default. */
  function seedHistorialWithDeviation() {
    findManyMovimientoStock.mockImplementation(
      async ({ where }: { where: { productoTiendaId?: string } }) => {
        const id = where?.productoTiendaId;
        if (id === "pt-a" || id === "pt-b") {
          return [
            {
              id: `mov-hist-${id}`,
              fecha: new Date("2026-01-01"),
              tipo: "COMPRA",
              cantidad: 5,
              costoUnitario: 40,
              costoTotal: 200,
              costoAnterior: 0,
              costoNuevo: 40,
              existenciaAnterior: 0,
              motivo: null,
              usuario: { nombre: "Tester" },
            },
          ];
        }
        return [];
      },
    );
  }

  it("propagates the tenant scope through analizarCPPTienda: the homonym's deviation never appears (criterion 5)", async () => {
    seedProductoTiendaCPP();
    seedHistorialWithDeviation();

    const desviaciones = await detectarDesviacionesCPP({
      negocioId: NEGOCIO_A,
      tiendaId: CPP_TIENDA_ID,
    });

    expect(desviaciones.map((d) => d.productoId)).toEqual(["pt-a"]);
  });

  it("keeps umbralPorcentaje's default of 10 when absent", async () => {
    seedProductoTiendaCPP();
    seedHistorialWithDeviation();

    const withDefault = await detectarDesviacionesCPP({
      negocioId: NEGOCIO_A,
      tiendaId: CPP_TIENDA_ID,
    });
    const withExplicit10 = await detectarDesviacionesCPP({
      negocioId: NEGOCIO_A,
      tiendaId: CPP_TIENDA_ID,
      umbralPorcentaje: 10,
    });

    expect(withDefault.map((d) => d.productoId)).toEqual(withExplicit10.map((d) => d.productoId));
  });

  it("is symmetric: negocioId NEGOCIO_B, same tiendaId, sees only its own homonym's deviation pt-b — never pt-a's (closes the E-008 gap)", async () => {
    seedProductoTiendaCPP();
    seedHistorialWithDeviation();

    const desviaciones = await detectarDesviacionesCPP({
      negocioId: NEGOCIO_B,
      tiendaId: CPP_TIENDA_ID,
    });

    expect(desviaciones.map((d) => d.productoId)).toEqual(["pt-b"]);
  });
});

/* ------------------------------------------------------------------------------- */
/* migrarDatosHistoricosCPP — the feature's ONLY write. criterion 5, and the        */
/* count !== 1 error path (E-031: no interpolated exception).                       */
/* ------------------------------------------------------------------------------- */

const [msBaseA, msBaseB, msBaseC] = TENANT_ISOLATION_FIXTURE_ROWS.movimientoStock;
const MOV_TIENDA_ID = msBaseA.tiendaId as string;
const MOV_CONTROL_TIENDA_ID = msBaseC.tiendaId as string;

const MOVIMIENTO_ROWS = [
  {
    ...msBaseA,
    id: "mov-a",
    tipo: "COMPRA",
    costoUnitario: null,
    cantidad: 3,
    fecha: new Date("2026-01-01"),
    productoTienda: { costo: 55, producto: { nombre: "Producto Test" } },
  },
  {
    ...msBaseB,
    id: "mov-b",
    tipo: "COMPRA",
    costoUnitario: null,
    cantidad: 3,
    fecha: new Date("2026-01-01"),
    productoTienda: { costo: 55, producto: { nombre: "Producto Test" } },
  },
  {
    ...msBaseC,
    id: "mov-c",
    tipo: "COMPRA",
    costoUnitario: null,
    cantidad: 3,
    fecha: new Date("2026-01-01"),
    productoTienda: { costo: 999, producto: { nombre: "Producto Control" } },
  },
];

function seedMovimientosSinCosto() {
  findManyMovimientoStock.mockImplementation(
    async ({ where }: { where: WhereClause }) =>
      MOVIMIENTO_ROWS.filter((row) => matchesWhere(row, where)),
  );
}

describe("migrarDatosHistoricosCPP — read side (dryRun, default true)", () => {
  it("finds exactly its own negocio's movimientos (criterion 5): the homonym and the control never appear", async () => {
    seedMovimientosSinCosto();

    const reporte = await migrarDatosHistoricosCPP({ negocioId: NEGOCIO_A, tiendaId: MOV_TIENDA_ID });

    expect(reporte.movimientosEncontrados).toBe(1);
    expect(reporte.detalles.some((d) => d.includes("Producto Control"))).toBe(false);
    expect(updateManyMovimientoStock).not.toHaveBeenCalled();
  });

  it("calls movimientoStock.findMany with cppMovimientosSinCostoWhere(params)", async () => {
    seedMovimientosSinCosto();

    await migrarDatosHistoricosCPP({ negocioId: NEGOCIO_A, tiendaId: MOV_TIENDA_ID });

    expect(findManyMovimientoStock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: cppMovimientosSinCostoWhere({ negocioId: NEGOCIO_A, tiendaId: MOV_TIENDA_ID }),
      }),
    );
  });

  it("out of tenant: the zeroed report, with dryRun's two header lines still present (ADR 0084, § 2)", async () => {
    seedMovimientosSinCosto();

    const reporte = await migrarDatosHistoricosCPP({
      negocioId: NEGOCIO_A,
      tiendaId: MOV_CONTROL_TIENDA_ID,
    });

    expect(reporte.movimientosEncontrados).toBe(0);
    expect(reporte.movimientosProcesados).toBe(0);
    expect(reporte.errores).toBe(0);
    expect(reporte.detalles).toHaveLength(2);
  });

  it("is symmetric: negocioId NEGOCIO_B, same tiendaId, finds only its own homonym movimiento mov-b — never mov-a nor the control (closes the E-008 gap)", async () => {
    seedMovimientosSinCosto();

    const reporte = await migrarDatosHistoricosCPP({ negocioId: NEGOCIO_B, tiendaId: MOV_TIENDA_ID });

    expect(reporte.movimientosEncontrados).toBe(1);
    expect(reporte.detalles.some((d) => d.includes("Producto Control"))).toBe(false);
    expect(updateManyMovimientoStock).not.toHaveBeenCalled();
  });
});

describe("migrarDatosHistoricosCPP — write side (dryRun: false), the feature's only write", () => {
  it("scopes the updateMany with cppMovimientoUpdateWhere(negocioId, id) and keeps the same data payload (criterion 5)", async () => {
    seedMovimientosSinCosto();
    updateManyMovimientoStock.mockImplementation(
      async ({ where }: { where: WhereClause }) => {
        const row = MOVIMIENTO_ROWS.find((r) => matchesWhere(r, where));
        return { count: row ? 1 : 0 };
      },
    );

    const reporte = await migrarDatosHistoricosCPP({
      negocioId: NEGOCIO_A,
      tiendaId: MOV_TIENDA_ID,
      dryRun: false,
    });

    expect(updateManyMovimientoStock).toHaveBeenCalledTimes(1);
    expect(updateManyMovimientoStock).toHaveBeenCalledWith({
      where: cppMovimientoUpdateWhere({ negocioId: NEGOCIO_A, id: "mov-a" }),
      data: { costoUnitario: 0, costoTotal: 0, costoAnterior: 55, costoNuevo: 55 },
    });
    expect(reporte.movimientosProcesados).toBe(1);
    expect(reporte.errores).toBe(0);
  });

  it("a count other than 1 counts as an error, with a fixed message that names no exception (E-031)", async () => {
    seedMovimientosSinCosto();
    updateManyMovimientoStock.mockResolvedValue({ count: 0 });

    const reporte = await migrarDatosHistoricosCPP({
      negocioId: NEGOCIO_A,
      tiendaId: MOV_TIENDA_ID,
      dryRun: false,
    });

    expect(reporte.errores).toBe(1);
    expect(reporte.movimientosProcesados).toBe(0);
    expect(reporte.detalles).toContain("❌ Producto Test - No se pudo actualizar");
    // E-031: the runtime's own error message cites the data that broke it. None of that
    // may leak into the report — the line above is the ONLY thing this branch may write.
    expect(reporte.detalles.some((d) => /error|undefined|NaN/i.test(d))).toBe(false);
  });

  it("never reaches another negocio's movimiento with the write: only mov-a's own id is ever passed to updateMany", async () => {
    seedMovimientosSinCosto();
    updateManyMovimientoStock.mockResolvedValue({ count: 1 });

    await migrarDatosHistoricosCPP({ negocioId: NEGOCIO_A, tiendaId: MOV_TIENDA_ID, dryRun: false });

    for (const call of updateManyMovimientoStock.mock.calls) {
      const where = call[0].where as { id?: unknown };
      expect(where.id).toBe("mov-a");
    }
  });
});
