import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Opcional, útil para depurar y entender si se está creando más de una instancia
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : [],
  });

// Solo en desarrollo asigna al global
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
