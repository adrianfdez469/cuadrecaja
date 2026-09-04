import { prisma } from "@/lib/prisma";

/**
 * The business's QAB token, or null. `select` on its own, NEVER together with
 * `omit` (ADR 0013). TWO functions in the repository name `qabToken`: this one
 * and `loadQabTokens` in outboxDrain.ts, which runs on the dedicated pool
 * (ADR 0015) and now has THREE callers — the outbox drain, the order-poll slot
 * and the slug-learning phase of F-020. Nobody adds a `select` of their own.
 *
 * The value never reaches a response, a log or the browser: the only caller of
 * THIS function (singular) is the slug-forecast route, which puts it in an
 * Authorization header and forgets it (ADR 0006). The cron's learning phase uses
 * `loadQabTokens`, not this one.
 */
export async function loadQabToken(negocioId: string): Promise<string | null> {
  const row = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { qabToken: true },
  });

  const token = row?.qabToken;
  return token && token.length > 0 ? token : null;
}
