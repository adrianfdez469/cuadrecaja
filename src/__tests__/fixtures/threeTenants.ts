import { TENANT_RELATION_PATH } from "@/constants/tenantScope";
import type { ITenantScopedModel } from "@/constants/tenantScope";

/**
 * F-021 — the three-tenant fixture that ADR 0080 (§ "Mitad 2") and spec § 9.3 prescribe
 * for the criterion 6/9/10 isolation test (`../tenantIsolation.test.ts`).
 *
 * Three negocios, each covering a distinct failure mode — none decorative:
 *
 *   - `NEGOCIO_A` is the session's own tenant. Its row is the one a correct guard returns.
 *   - `NEGOCIO_B` is the HOMONYM: for every tenant-scoped model, its row carries the exact
 *     same non-tenant identifying value(s) as `NEGOCIO_A`'s row (see `MODEL_SCALAR_KEYS`
 *     below), differing ONLY in `negocioId`. Without this, "filtered by tenant" and "not
 *     filtered" would return identical results and the test would pass with the guard
 *     removed — E-008, the false-pass this fixture exists to rule out.
 *   - `NEGOCIO_C` is the CONTROL: its identifying value(s) never match `NEGOCIO_A`'s or
 *     `NEGOCIO_B`'s. Its only job is to never appear in either branch of the test. A guard
 *     implemented wider than the contract — e.g. one that matched on a shared attribute
 *     instead of `negocioId` — would still pass every A/B case and only `NEGOCIO_C`
 *     catches it (E-032).
 *
 * These are real UUID-shaped Prisma field names (verified against `prisma/schema.prisma`
 * on 2026-09-05), not test-only placeholders: `transferDestinations` really is keyed by
 * `tiendaId`, `cashBreakdownCierre`/`cashBreakdownMoneda` really are keyed by
 * `cierrePeriodoId`, and `productoProveedorLiquidacion` really is keyed by BOTH `cierreId`
 * and `proveedorId`. That is why they line up with the `withTenantScope` docstring's own
 * worked examples (contract § 2) verbatim.
 */

export const NEGOCIO_A = "11111111-1111-1111-1111-111111111111";
export const NEGOCIO_B = "22222222-2222-2222-2222-222222222222";
export const NEGOCIO_C = "33333333-3333-3333-3333-333333333333";

export type IFixtureRow = Record<string, unknown>;

/**
 * The non-tenant scalar field(s) a route would use to identify the row it wants, for
 * each model `TENANT_RELATION_PATH` knows about. Exhaustive on purpose (`satisfies
 * Record<ITenantScopedModel, ...>`): a model added to `TENANT_RELATION_PATH` without a
 * matching entry here fails to compile instead of silently getting an empty fixture.
 */
export const MODEL_SCALAR_KEYS = {
  tienda: ["id"],
  producto: ["id"],
  usuario: ["id"],
  proveedor: ["id"],
  tasaCambio: ["id"],
  transferDestinations: ["tiendaId"],
  cierrePeriodo: ["tiendaId"],
  productoTienda: ["tiendaId"],
  venta: ["tiendaId"],
  movimientoStock: ["tiendaId"],
  cashBreakdownCierre: ["cierrePeriodoId"],
  cashBreakdownMoneda: ["cierrePeriodoId"],
  productoProveedorLiquidacion: ["cierreId", "proveedorId"],
  // F-029, contract § 6.2: three new TENANT_RELATION_PATH entries need a matching
  // entry here or this `satisfies` fails to compile (criterion 2). Chosen with the
  // same criterion as the thirteen above — the scalar key a route would identify the
  // row by: `cliente` mirrors `proveedor` (empty path), `cuentaPorCobrar` mirrors
  // `venta` (`["tienda"]` path), `movimientoCuentaPorCobrar` mirrors
  // `cashBreakdownCierre` (two-hop path).
  cliente: ["id"],
  cuentaPorCobrar: ["tiendaId"],
  movimientoCuentaPorCobrar: ["cuentaPorCobrarId"],
} as const satisfies Record<ITenantScopedModel, readonly string[]>;

/** Shared between N_A and N_B — the homonym. Same value(s), different negocioId. */
const HOMONYM_VALUES = ["recurso-homonimo-1", "recurso-homonimo-2"] as const;
/** Only on N_C — the control. Must never equal any HOMONYM_VALUES entry. */
const CONTROL_VALUES = ["recurso-control-1", "recurso-control-2"] as const;

function scalarValues(
  model: ITenantScopedModel,
  pool: readonly string[],
): Record<string, string> {
  const keys = MODEL_SCALAR_KEYS[model];
  return Object.fromEntries(keys.map((key, i) => [key, pool[i]]));
}

/**
 * The `where` a route would build BEFORE any tenant clause is applied — i.e. exactly
 * what an unprotected handler passes to Prisma verbatim. Used both as the "without the
 * tenant clause" branch and as the base object handed to `withTenantScope`.
 */
export function baseWhereFor(model: ITenantScopedModel): Record<string, unknown> {
  return scalarValues(model, HOMONYM_VALUES);
}

function nestNegocioId(path: readonly string[], negocioId: string): Record<string, unknown> {
  return path.reduceRight<Record<string, unknown>>(
    (acc, segment) => ({ [segment]: acc }),
    { negocioId },
  );
}

function buildRow(
  scalars: Record<string, unknown>,
  negocioId: string,
  path: readonly string[],
): IFixtureRow {
  return path.length === 0
    ? { ...scalars, negocioId }
    : { ...scalars, ...nestNegocioId(path, negocioId) };
}

/**
 * Three rows per model — [rowA, rowB, rowC], always in that order. Every consumer relies
 * on that order: `rows[0]` is N_A's row (the one that must survive), `rows[1]` is N_B's
 * homonym (must disappear once the tenant clause is applied), `rows[2]` is N_C's control
 * (must never appear in either branch).
 */
export const TENANT_ISOLATION_FIXTURE_ROWS: Record<
  ITenantScopedModel,
  readonly [IFixtureRow, IFixtureRow, IFixtureRow]
> = Object.fromEntries(
  (Object.keys(TENANT_RELATION_PATH) as ITenantScopedModel[]).map((model) => {
    const path = TENANT_RELATION_PATH[model];
    const homonymScalars = scalarValues(model, HOMONYM_VALUES);
    const controlScalars = scalarValues(model, CONTROL_VALUES);
    return [
      model,
      [
        buildRow(homonymScalars, NEGOCIO_A, path),
        buildRow(homonymScalars, NEGOCIO_B, path),
        buildRow(controlScalars, NEGOCIO_C, path),
      ] as const,
    ];
  }),
) as Record<ITenantScopedModel, readonly [IFixtureRow, IFixtureRow, IFixtureRow]>;
