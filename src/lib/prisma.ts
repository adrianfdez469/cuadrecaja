import { Negocio, Prisma, PrismaClient } from '@prisma/client';

const createPrismaClient = () =>
  new PrismaClient({
    // Opcional, útil para depurar y entender si se está creando más de una instancia
   //log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],

    // Server-only secret: invisible to every query unless a caller opts in
    // explicitly with `omit: { qabToken: false }`. See ADR 0006.
    omit: { negocio: { qabToken: true } },
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Solo en desarrollo asigna al global
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * The shared client, or a transaction client derived from it. Helpers that must
 * work both inside and outside a `$transaction` take this type.
 */
export type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

/**
 * A `Negocio` row as the shared client returns it: without the server-only
 * `qabToken`, which the global `omit` above strips from every query (ADR 0006).
 * Anything that consumes a business row read through `prisma` types it as this.
 */
export type NegocioRow = Omit<Negocio, 'qabToken'>;
