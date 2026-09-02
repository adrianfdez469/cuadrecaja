import { Prisma } from "@prisma/client";
import { prisma, type PrismaClientLike } from "./prisma";

/**
 * Generic idempotency support, reusable by any endpoint — there is no
 * per-domain table.
 *
 * Why it is needed: a mutating request can arrive twice. The axios interceptor
 * retries on timeout/network error, and aborting the client does not cancel the
 * handler, so the original execution keeps running and commits anyway. Without a
 * shared key, the retry applies the same work a second time.
 *
 * Usage — claim first, store last, both inside the endpoint's own transaction:
 *
 *   const response = await prisma.$transaction(async (tx) => {
 *     await claimIdempotencyKey(tx, { key, scopeId, endpoint });
 *     const result = await doTheWork(tx);
 *     await storeIdempotentResponse(tx, key, result);
 *     return result;
 *   });
 *
 * Claiming inside the transaction is what makes this safe: if the work fails,
 * the rollback releases the key too, so the caller can retry with the same one.
 * A key written in a separate transaction would survive a failed handler and
 * make the next attempt answer "already done" for something that never
 * happened — worse than the duplicate it was meant to prevent.
 */

/**
 * How long a key stays around. It only has to outlive the retries of its own
 * request — the axios interceptor gives up after ~1 minute, and a user retrying
 * by hand takes minutes at most. A day is a wide margin that also keeps the
 * recent history readable while debugging.
 */
export const IDEMPOTENCY_KEY_TTL_HOURS = 24;

/** Thrown when the key was already claimed by an earlier execution. */
export class DuplicateRequestError extends Error {
  constructor(readonly key: string) {
    super(`Request ${key} was already processed`);
    this.name = "DuplicateRequestError";
  }
}

interface IdempotencyClaim {
  key: string;
  /** Tenant that owns the key, normally negocioId. */
  scopeId: string;
  /** Route claiming the key, e.g. "POST /api/movimiento". */
  endpoint: string;
}

/**
 * Reserves the key as the first operation of the transaction, so a concurrent
 * retry collides on the unique index before redoing any work.
 *
 * @throws {DuplicateRequestError} if another execution already claimed it.
 */
export const claimIdempotencyKey = async (
  tx: PrismaClientLike,
  { key, scopeId, endpoint }: IdempotencyClaim,
): Promise<void> => {
  try {
    await tx.idempotencyKey.create({ data: { key, scopeId, endpoint } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateRequestError(key);
    }
    throw error;
  }
};

/**
 * Records the response of the original execution so a later retry can replay it
 * verbatim instead of answering with an empty payload.
 */
export const storeIdempotentResponse = async (
  tx: PrismaClientLike,
  key: string,
  response: unknown,
): Promise<void> => {
  await tx.idempotencyKey.update({
    where: { key },
    data: { response: response as Prisma.InputJsonValue },
  });
};

/**
 * Looks up the response of an already-processed request. Scope and endpoint are
 * part of the match: a key replayed against another tenant or another route is
 * treated as unknown rather than answered with someone else's response.
 *
 * Returns `undefined` when the key is unknown, and `null` when it was claimed
 * but holds no response yet — meaning the original execution is still in flight.
 */
export const findIdempotentResponse = async <
  T extends object = Record<string, unknown>,
>({
  key,
  scopeId,
  endpoint,
}: IdempotencyClaim): Promise<T | null | undefined> => {
  const stored = await prisma.idempotencyKey.findFirst({
    where: { key, scopeId, endpoint },
    select: { response: true },
  });
  if (!stored) return undefined;
  return (stored.response as T | null) ?? null;
};

/**
 * Drops keys past their TTL. The table grows one row per protected operation, so
 * without this it never stops growing.
 *
 * Deleting an expired key is safe: any request that could still be replaying it
 * gave up long ago, and a brand new request carries a brand new key.
 */
export const purgeExpiredIdempotencyKeys = async (): Promise<number> => {
  const expiresBefore = new Date(
    Date.now() - IDEMPOTENCY_KEY_TTL_HOURS * 60 * 60 * 1000,
  );
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { createdAt: { lt: expiresBefore } },
  });
  return count;
};
