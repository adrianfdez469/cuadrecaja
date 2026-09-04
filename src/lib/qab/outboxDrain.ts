import type { Prisma } from "@prisma/client";
import {
  QAB_OUTBOX_BATCH_SIZE,
  QAB_OUTBOX_ERROR_CODES,
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_SYNC_RUN_DEADLINE_MS,
  QAB_SYNC_TX_MAX_WAIT_MS,
  QAB_SYNC_TX_TIMEOUT_MS,
} from "@/constants/qab";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import {
  collectQabPermanentFailures,
  emptyQabOutboxDrainReport,
  groupOutboxEventsByNegocio,
  planOutboxAck,
  toQabCatalogBatch,
} from "@/lib/qab/outboxAck";
import { logQabPermanentFailure } from "@/lib/qab/qabOutboxLog";
import type { IQabPostOutcome } from "@/lib/qab/qabCatalogClient";
import type { IOutboxEvento, IQabOutboxEntity, IQabOutboxOperation } from "@/schemas/qabOutbox";
import type {
  IQabCatalogBatch,
  IQabOutboxAckPlan,
  IQabOutboxDrainReport,
  IQabPermanentFailure,
} from "@/schemas/qabSync";

/** A row exactly as `SELECT *` returns it: `id` is still a BigInt here. */
interface IOutboxEventoRow {
  id: bigint;
  negocioId: string;
  entidad: string;
  entidadId: string;
  operacion: string;
  ocurridoAt: Date;
  payload: unknown;
  intentos: number;
  procesadoAt: Date | null;
  ultimoError: string | null;
}

/**
 * The contract's drain query, inside the caller's transaction. Rows come back
 * locked with FOR UPDATE SKIP LOCKED and stay locked until the transaction
 * commits. `id` is already a decimal string.
 *
 * The online-store switch is filtered HERE, in the claim itself, and not after
 * the rows come back (ADR 0021): otherwise the rows of a disabled business hold
 * the head of the batch of 500 and starve everyone else. Those rows stay pending
 * and untouched - no `intentos++`, no `ultimoError` - and walk back in on their
 * own the day the switch is turned on.
 *
 * `FOR UPDATE OF o` is mandatory: without the `OF o` the `EXISTS` subquery risks
 * locking `Negocio` rows for the whole duration of the drain transaction.
 */
export async function claimOutboxBatch(tx: Prisma.TransactionClient): Promise<IOutboxEvento[]> {
  const rows = await tx.$queryRaw<IOutboxEventoRow[]>`
    SELECT o.* FROM "OutboxEvento" o
    WHERE o."procesadoAt" IS NULL
      AND o.intentos < ${QAB_OUTBOX_MAX_ATTEMPTS}
      AND EXISTS (SELECT 1 FROM "Negocio" n
                  WHERE n.id = o."negocioId" AND n."tiendaOnlineHabilitada" = true)
    ORDER BY o.id LIMIT ${QAB_OUTBOX_BATCH_SIZE}
    FOR UPDATE OF o SKIP LOCKED
  `;

  // No validation on read: rows are validated on the way in
  // (`outboxEventoCreateSchema`) and trusted on the way out. The only thing this
  // function must guarantee is that no BigInt escapes it (E-003).
  return rows.map((row) => ({
    id: row.id.toString(),
    negocioId: row.negocioId,
    entidad: row.entidad as IQabOutboxEntity,
    entidadId: row.entidadId,
    operacion: row.operacion as IQabOutboxOperation,
    ocurridoAt: row.ocurridoAt,
    payload: row.payload,
    intentos: row.intentos,
    procesadoAt: row.procesadoAt,
    ultimoError: row.ultimoError,
  }));
}

/** Reads the QAB tokens of the given businesses. The only place that reads `qabToken`. */
export async function loadQabTokens(
  tx: Prisma.TransactionClient,
  negocioIds: string[],
): Promise<Map<string, string>> {
  if (negocioIds.length === 0) return new Map();

  // `select` on its own, NEVER together with `omit`: Prisma rejects both at once,
  // and an explicit `select` already beats the global `omit`. See ADR 0013.
  const rows = await tx.negocio.findMany({
    where: { id: { in: negocioIds } },
    select: { id: true, qabToken: true },
  });

  const tokens = new Map<string, string>();
  for (const row of rows) {
    if (row.qabToken && row.qabToken.length > 0) tokens.set(row.id, row.qabToken);
  }
  return tokens;
}

export interface IQabOutboxDrainDeps {
  /** Injected so the drain can be exercised without a network. */
  post: (args: {
    negocioId: string;
    token: string;
    batch: IQabCatalogBatch;
  }) => Promise<IQabPostOutcome>;
  now?: () => Date;
  deadlineAt?: number;
}

/** One transaction, one run. See ADR 0010. */
export async function drainQabOutbox(
  deps: IQabOutboxDrainDeps,
): Promise<IQabOutboxDrainReport> {
  const now = deps.now ?? (() => new Date());
  const deadlineAt = deps.deadlineAt ?? Date.now() + QAB_SYNC_RUN_DEADLINE_MS;

  return qabPrisma.$transaction<IQabOutboxDrainReport>(
    async (tx) => {
      const rows = await claimOutboxBatch(tx);
      if (rows.length === 0) return emptyQabOutboxDrainReport();

      const groups = groupOutboxEventsByNegocio(rows);
      const tokens = await loadQabTokens(
        tx,
        groups.map((group) => group.negocioId),
      );

      const processedIds: string[] = [];
      const failedAcks: IQabOutboxAckPlan["failedAcks"] = [];
      const byBusiness: IQabOutboxDrainReport["byBusiness"] = [];
      const permanentFailures: IQabPermanentFailure[] = [];

      for (const group of groups) {
        const token = tokens.get(group.negocioId);

        if (!token) {
          for (const row of group.rows) {
            failedAcks.push({ id: row.id, ultimoError: QAB_OUTBOX_ERROR_CODES.tokenMissing });
          }
          byBusiness.push({
            negocioId: group.negocioId,
            events: group.rows.length,
            processed: 0,
            failed: group.rows.length,
            outcome: "skipped_no_token",
          });
          continue;
        }

        if (Date.now() >= deadlineAt) {
          // Out of time: the rows are left untouched — `intentos` intact — and
          // stay pending for the next run.
          byBusiness.push({
            negocioId: group.negocioId,
            events: group.rows.length,
            processed: 0,
            failed: 0,
            outcome: "skipped_deadline",
          });
          continue;
        }

        const batch = toQabCatalogBatch(group.negocioId, group.rows);
        const outcome = await deps.post({ negocioId: group.negocioId, token, batch });
        const plan = planOutboxAck(group.rows, outcome);

        // Named in the log and in the report so it does not burn the six
        // attempts in silence (F-005, acceptance criterion 12). The retry
        // mechanics are untouched: the rows are acknowledged exactly as
        // `planOutboxAck` says.
        for (const failure of collectQabPermanentFailures(group.rows, outcome)) {
          logQabPermanentFailure(failure);
          permanentFailures.push(failure);
        }

        processedIds.push(...plan.processedIds);
        failedAcks.push(...plan.failedAcks);
        byBusiness.push({
          negocioId: group.negocioId,
          events: group.rows.length,
          processed: plan.processedIds.length,
          failed: plan.failedAcks.length,
          outcome: outcome.kind === "ok" ? "ok" : "error",
        });
      }

      if (processedIds.length > 0) {
        await tx.outboxEvento.updateMany({
          where: { id: { in: processedIds.map((id) => BigInt(id)) } },
          data: { procesadoAt: now(), ultimoError: null },
        });
      }

      // Failures are grouped by identical message so the write stays a handful of
      // updateMany calls instead of one update per row.
      const idsByMessage = new Map<string, string[]>();
      for (const ack of failedAcks) {
        const ids = idsByMessage.get(ack.ultimoError);
        if (ids) ids.push(ack.id);
        else idsByMessage.set(ack.ultimoError, [ack.id]);
      }
      for (const [message, ids] of idsByMessage) {
        await tx.outboxEvento.updateMany({
          where: { id: { in: ids.map((id) => BigInt(id)) } },
          data: { intentos: { increment: 1 }, ultimoError: message },
        });
      }

      return {
        claimed: rows.length,
        eventIds: rows.map((row) => row.id),
        businesses: groups.length,
        processed: processedIds.length,
        failed: failedAcks.length,
        byBusiness,
        permanentFailures,
      };
    },
    { timeout: QAB_SYNC_TX_TIMEOUT_MS, maxWait: QAB_SYNC_TX_MAX_WAIT_MS },
  );
}
