import { PrismaClient } from "@prisma/client";
import { QAB_SYNC_DB_CONNECTION_LIMIT_DEFAULT } from "@/constants/qab";

const CONNECTION_LIMIT_PARAM = "connection_limit";

function resolveConnectionLimit(): number {
  const raw = Number(process.env.QAB_SYNC_DB_CONNECTION_LIMIT);
  return Number.isInteger(raw) && raw > 0 ? raw : QAB_SYNC_DB_CONNECTION_LIMIT_DEFAULT;
}

/** The application's DATABASE_URL with a small, dedicated `connection_limit`. */
function buildQabDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.searchParams.set(CONNECTION_LIMIT_PARAM, String(resolveConnectionLimit()));
    return url.toString();
  } catch {
    // Not a URL we can rewrite: fall back to the value as configured rather than
    // failing the run. The pool is then the shared default, which is a
    // degradation of ADR 0015, not a correctness problem.
    return raw;
  }
}

function createQabPrismaClient(): PrismaClient {
  const url = buildQabDatabaseUrl();
  const client = new PrismaClient({
    // Same server-only secret policy as the shared client (ADR 0006):
    // `loadQabTokens` still has to opt in with an explicit `select` (ADR 0013).
    omit: { negocio: { qabToken: true } },
    ...(url ? { datasourceUrl: url } : {}),
  });
  // The `omit` narrows the client's `Negocio` result type, which makes it
  // unassignable to the plain `PrismaClient`. The exported surface is kept wide
  // on purpose: every signature of the F-002 contract takes the plain
  // `Prisma.TransactionClient`. The runtime omit is unaffected by the cast, and
  // nothing in F-002 reads a whole `Negocio` row through this client.
  return client as unknown as PrismaClient;
}

const globalForQabPrisma = globalThis as unknown as {
  qabPrisma: PrismaClient | undefined;
};

function getQabPrismaClient(): PrismaClient {
  if (!globalForQabPrisma.qabPrisma) {
    globalForQabPrisma.qabPrisma = createQabPrismaClient();
  }
  return globalForQabPrisma.qabPrisma;
}

/**
 * A PrismaClient reserved for QAB's two long-lived interactive transactions
 * (the outbox drain, up to QAB_SYNC_TX_TIMEOUT_MS; the order-poll advisory
 * lock, up to QAB_ORDER_POLL_TX_TIMEOUT_MS), with its OWN small connection
 * pool — separate from the `prisma` singleton in `src/lib/prisma.ts` that
 * serves POS traffic. See ADR 0015: a slow drain holding a connection for up
 * to 45 s every 2 minutes must never be able to starve the pool the POS reads
 * and writes through, because the POS is what the business runs on.
 *
 * The underlying client is built on first use — never at import time — so that
 * importing any module of `src/lib/qab/` (the pure helpers included) does not
 * require a DATABASE_URL. It is memoised on `globalThis`, like the shared
 * client, so a hot reload does not open a new pool on every edit.
 */
export const qabPrisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getQabPrismaClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
