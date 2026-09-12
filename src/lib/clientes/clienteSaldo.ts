import { prisma } from "@/lib/prisma";
import { withTenantScope } from "@/lib/tenantScope";

/** One aggregated row: a cliente and the sum of its live accounts. */
export interface ISaldoPendienteRow {
  clienteId: string;
  saldoPendiente: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * PURE. Sums by `clienteId` and rounds each total to two decimals — the same rounding
 * `computeSaldoAlCierre` (`src/lib/cuentasPorCobrar/saldo.ts`) applies to a single account.
 * A cliente absent from `rows` is absent from the result; the caller defaults it to 0.
 */
export function buildSaldoPorClienteMap(
  rows: ISaldoPendienteRow[],
): Record<string, number> {
  const totals: Record<string, number> = {};

  const list = Array.isArray(rows) ? rows : [];
  for (const row of list) {
    if (!row || !row.clienteId) continue;
    const current = totals[row.clienteId] ?? 0;
    totals[row.clienteId] = current + (Number(row.saldoPendiente) || 0);
  }

  for (const clienteId of Object.keys(totals)) {
    totals[clienteId] = round2(totals[clienteId]);
  }

  return totals;
}

/**
 * PURE. Attaches the balance of `cliente` from a map built by `buildSaldoPorClienteMap`,
 * defaulting an absent cliente to 0. It is the single place that default lives, so the four
 * callers that build an `IClienteConSaldo` cannot drift apart.
 */
export function attachSaldo<T extends { id: string }>(
  cliente: T,
  saldos: Record<string, number>,
): T & { saldo: number } {
  return { ...cliente, saldo: saldos[cliente.id] ?? 0 };
}

/**
 * The live balance of each cliente, in base currency: the sum of
 * `CuentaPorCobrar.saldoPendiente` over the accounts of the business whose `settledAt` is
 * null. `saldoPendiente` is defined by the comment on that column in `prisma/schema.prisma`,
 * which points at `computeSaldoAlCierre`; this function does not recompute it from movements.
 *
 * ONE aggregate query (`groupBy` by `clienteId`) for the whole list, not one per cliente.
 * Scoped with `withTenantScope("cuentaPorCobrar", …, negocioId)`. With an empty
 * `clienteIds` it returns `{}` without querying.
 *
 * A cliente KEY is present only when it has at least one live account — including one whose
 * balance is zero. That is what the DELETE gate reads (contract § 5.5: "tiene alguna
 * CuentaPorCobrar con settledAt IS NULL"), so it is not derived from the figure being > 0.
 */
export async function loadSaldoPorCliente(params: {
  negocioId: string;
  clienteIds: string[];
}): Promise<Record<string, number>> {
  const { negocioId, clienteIds } = params;

  const ids = Array.from(
    new Set((Array.isArray(clienteIds) ? clienteIds : []).filter(Boolean)),
  );
  if (ids.length === 0) return {};

  const grouped = await prisma.cuentaPorCobrar.groupBy({
    by: ["clienteId"],
    where: withTenantScope(
      "cuentaPorCobrar",
      { clienteId: { in: ids }, settledAt: null },
      negocioId,
    ),
    _sum: { saldoPendiente: true },
  });

  return buildSaldoPorClienteMap(
    grouped.map((row) => ({
      clienteId: row.clienteId,
      saldoPendiente: row._sum.saldoPendiente ?? 0,
    })),
  );
}
