import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  QAB_ORDER_POLL_LOCK_NAMESPACE,
  QAB_ORDER_POLL_TX_MAX_WAIT_MS,
  QAB_ORDER_POLL_TX_TIMEOUT_MS,
} from "@/constants/qab";
import { qabPrisma } from "@/lib/qab/qabPrisma";

const SHA256 = "sha256";

/**
 * The 64-bit advisory-lock key of a business, derived from its UUID: the first
 * eight bytes of sha256(QAB_ORDER_POLL_LOCK_NAMESPACE + negocioId), read as a
 * signed big-endian int64. Pure, deterministic and stable across deploys. See ADR 0009.
 */
export function qabOrderPollLockKey(negocioId: string): bigint {
  return createHash(SHA256)
    .update(QAB_ORDER_POLL_LOCK_NAMESPACE + negocioId)
    .digest()
    .readBigInt64BE(0);
}

export type IQabOrderPollSlot<T> =
  | { acquired: true; value: T }
  | { acquired: false; value: null };

/**
 * Runs `run` holding the business's advisory lock, and does NOT run it at all
 * when another run already holds it. The lock is transaction-scoped: it is taken
 * with pg_try_advisory_xact_lock inside an interactive transaction and released
 * by the commit, so a crashed run never leaves it stuck.
 */
export async function withQabOrderPollLock<T>(
  negocioId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<IQabOrderPollSlot<T>> {
  const key = qabOrderPollLockKey(negocioId);

  return qabPrisma.$transaction<IQabOrderPollSlot<T>>(
    async (tx) => {
      const rows = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${key}) AS acquired
      `;
      // Not acquired: end the transaction right away instead of holding it open,
      // and never invoke `run` — not even once.
      if (!rows[0]?.acquired) return { acquired: false, value: null };
      return { acquired: true, value: await run(tx) };
    },
    { timeout: QAB_ORDER_POLL_TX_TIMEOUT_MS, maxWait: QAB_ORDER_POLL_TX_MAX_WAIT_MS },
  );
}
