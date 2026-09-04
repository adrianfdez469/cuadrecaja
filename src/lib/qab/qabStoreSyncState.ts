import {
  QAB_OUTBOX_ERROR_CODES,
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_STORE_SYNC_CODES,
  QAB_STORE_SYNC_STATE_MAX_ROWS,
} from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import type {
  IQabStoreSyncCode,
  IQabStoreSyncState,
} from "@/schemas/tiendaOnline";

/** The STORE entity, as `OutboxEvento.entidad` stores it. */
const STORE_ENTITY = "STORE";

/**
 * One pending outbox row of ONE local, as `buildStoreSyncState` reads it. It
 * carries no `entidadId`: by the time these reach the builder they have already
 * been grouped by local, and a key repeated on every row invites deriving
 * tenancy from it.
 */
export interface IStoreSyncRow {
  ocurridoAt: Date;
  intentos: number;
  ultimoError: string | null;
}

const TOKEN_MISSING_CODE: IQabStoreSyncCode = "TOKEN_MISSING";
const UNKNOWN_CODE: IQabStoreSyncCode = "UNKNOWN";

/**
 * PURE. Maps the shapes F-002 writes into OutboxEvento.ultimoError to a closed
 * code. Recognises `EVENT:<code>`, `HTTP:<status>:<body>`, `TRANSPORT:...`,
 * `QAB_TOKEN_MISSING`. Everything else is "UNKNOWN". The raw string NEVER
 * leaves the database (ADR 0034).
 */
export function normalizeOutboxErrorCode(
  ultimoError: string | null,
): IQabStoreSyncCode | null {
  if (ultimoError === null || ultimoError.length === 0) return null;

  if (ultimoError === QAB_OUTBOX_ERROR_CODES.tokenMissing) {
    return TOKEN_MISSING_CODE;
  }

  // One scan over the closed vocabulary. It covers `EVENT:<code>` (the code is
  // QAB's own), `TRANSPORT:<message>` (TRANSPORT is itself one of the codes) and
  // an `HTTP:<status>:<body>` whose body names the refusal. Anything the
  // vocabulary does not contain collapses into UNKNOWN, so no third-party text
  // can ever reach the screen.
  const known = QAB_STORE_SYNC_CODES.find((code) => ultimoError.includes(code));
  return known ?? UNKNOWN_CODE;
}

/** The pending row with the greatest `ocurridoAt`; later positions win a tie. */
function mostRecent(rows: IStoreSyncRow[]): IStoreSyncRow | undefined {
  return rows.reduce<IStoreSyncRow | undefined>(
    (latest, row) =>
      latest === undefined || row.ocurridoAt.getTime() >= latest.ocurridoAt.getTime()
        ? row
        : latest,
    undefined,
  );
}

/** The pending row with the smallest `ocurridoAt`; earlier positions win a tie. */
function oldest(rows: IStoreSyncRow[]): IStoreSyncRow | undefined {
  return rows.reduce<IStoreSyncRow | undefined>(
    (earliest, row) =>
      earliest === undefined || row.ocurridoAt.getTime() < earliest.ocurridoAt.getTime()
        ? row
        : earliest,
    undefined,
  );
}

/** PURE. The pending rows of ONE local -> its state. No rows means SYNCED. */
export function buildStoreSyncState(rows: IStoreSyncRow[]): IQabStoreSyncState {
  if (rows.length === 0) {
    return { state: "SYNCED", code: null, attempts: 0, since: null };
  }

  const since = oldest(rows)?.ocurridoAt.toISOString() ?? null;
  const failed = rows.filter((row) => row.ultimoError !== null);
  const latestFailure = mostRecent(failed);

  if (latestFailure === undefined) {
    // Queued and never attempted: nothing has gone wrong yet.
    return { state: "PENDING", code: null, attempts: 0, since };
  }

  return {
    state: latestFailure.intentos >= QAB_OUTBOX_MAX_ATTEMPTS ? "BLOCKED" : "FAILED",
    code: normalizeOutboxErrorCode(latestFailure.ultimoError),
    attempts: latestFailure.intentos,
    since,
  };
}

/**
 * One query for every local of the business, bounded by
 * QAB_STORE_SYNC_STATE_MAX_ROWS. Reads ONLY unprocessed rows
 * (`procesadoAt: null`): a processed event has nothing to report, and the
 * history of processed events grows without limit.
 *
 * `negocioId` goes in the `where` even though `entidadId` is a UUID: tenancy is
 * never deduced from the uniqueness of a key.
 */
export async function readStoreSyncStates(
  negocioId: string,
  tiendaIds: string[],
): Promise<Map<string, IQabStoreSyncState>> {
  const states = new Map<string, IQabStoreSyncState>();
  if (tiendaIds.length === 0) return states;

  const rows = await prisma.outboxEvento.findMany({
    where: {
      negocioId,
      entidad: STORE_ENTITY,
      entidadId: { in: tiendaIds },
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

  const byTienda = new Map<string, IStoreSyncRow[]>();
  for (const row of rows) {
    const group = byTienda.get(row.entidadId);
    if (group) group.push(row);
    else byTienda.set(row.entidadId, [row]);
  }

  for (const tiendaId of tiendaIds) {
    states.set(tiendaId, buildStoreSyncState(byTienda.get(tiendaId) ?? []));
  }

  return states;
}
