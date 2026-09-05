import {
  QAB_PRODUCT_ENTITY,
  QAB_STORE_SYNC_STATE_MAX_ROWS,
} from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import { buildStoreSyncState } from "@/lib/qab/qabStoreSyncState";
import type { IStoreSyncRow } from "@/lib/qab/qabStoreSyncState";
import type { IQabStoreSyncState } from "@/schemas/tiendaOnline";

/**
 * How the publishing tab reads «how is our send going» for one product.
 *
 * It reuses `buildStoreSyncState` and `IStoreSyncRow` from
 * `qabStoreSyncState.ts` verbatim: `IQabStoreSyncState` is not STORE's own type,
 * it is the generic shape of "how is the sync of this going", and duplicating it
 * would be a repeated interface.
 */

/** Everything is up to date: no pending event has anything to report. */
const SYNCED_STATE: IQabStoreSyncState = {
  state: "SYNCED",
  code: null,
  attempts: 0,
  since: null,
};

/** Worst first. The screen never invents a precedence of its own. */
const STATE_SEVERITY: Record<IQabStoreSyncState["state"], number> = {
  BLOCKED: 3,
  FAILED: 2,
  PENDING: 1,
  SYNCED: 0,
};

/**
 * Pending PRODUCT events of these ProductoTienda rows, one state per row.
 * Reads ONLY `procesadoAt: null`, capped by QAB_STORE_SYNC_STATE_MAX_ROWS, with
 * `negocioId` in the `where`. One query, never 1 + N.
 */
export async function readQabProductoTiendaSyncStates(
  negocioId: string,
  productoTiendaIds: string[],
): Promise<Map<string, IQabStoreSyncState>> {
  const states = new Map<string, IQabStoreSyncState>();
  if (productoTiendaIds.length === 0) return states;

  const rows = await prisma.outboxEvento.findMany({
    where: {
      negocioId,
      entidad: QAB_PRODUCT_ENTITY,
      entidadId: { in: productoTiendaIds },
      procesadoAt: null,
    },
    select: {
      entidadId: true,
      ocurridoAt: true,
      intentos: true,
      ultimoError: true,
    },
    orderBy: { id: "asc" },
    take: QAB_STORE_SYNC_STATE_MAX_ROWS,
  });

  const byProductoTienda = new Map<string, IStoreSyncRow[]>();
  for (const row of rows) {
    const group = byProductoTienda.get(row.entidadId);
    if (group) group.push(row);
    else byProductoTienda.set(row.entidadId, [row]);
  }

  for (const productoTiendaId of productoTiendaIds) {
    states.set(
      productoTiendaId,
      buildStoreSyncState(byProductoTienda.get(productoTiendaId) ?? []),
    );
  }

  return states;
}

/**
 * PURE. The states of every store row of ONE product -> the single state the
 * screen shows. Precedence, worst first: BLOCKED > FAILED > PENDING > SYNCED.
 * `attempts` is the maximum, `since` the earliest non-null, `code` the one of
 * the state that won. An empty array is
 * `{ state: "SYNCED", code: null, attempts: 0, since: null }`.
 */
export function mergeQabProductSyncState(
  states: IQabStoreSyncState[],
): IQabStoreSyncState {
  if (states.length === 0) return SYNCED_STATE;

  const winner = states.reduce((worst, current) =>
    STATE_SEVERITY[current.state] > STATE_SEVERITY[worst.state]
      ? current
      : worst,
  );

  const attempts = states.reduce(
    (highest, current) => Math.max(highest, current.attempts),
    0,
  );

  const since = states.reduce<string | null>((earliest, current) => {
    if (current.since === null) return earliest;
    if (earliest === null) return current.since;
    return current.since < earliest ? current.since : earliest;
  }, null);

  return { state: winner.state, code: winner.code, attempts, since };
}
