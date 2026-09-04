import { prisma } from "@/lib/prisma";

/**
 * The business's QAB token, or null. `select` on its own, NEVER together with
 * `omit` (ADR 0013). Second and last place in the repository that names
 * `qabToken`; the other is `loadQabTokens` in outboxDrain.ts, which runs on the
 * dedicated pool inside the drain transaction (ADR 0015).
 *
 * The value never reaches a response, a log or the browser: the only caller is
 * the slug-forecast route, which puts it in an Authorization header and forgets
 * it (ADR 0006).
 */
export async function loadQabToken(negocioId: string): Promise<string | null> {
  const row = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: { qabToken: true },
  });

  const token = row?.qabToken;
  return token && token.length > 0 ? token : null;
}
