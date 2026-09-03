import type { Prisma } from "@prisma/client";

/**
 * Whitelist of the Negocio columns the platform-administration endpoints
 * return. A column added to the model is invisible here until someone names
 * it. NEVER combine with `omit`: Prisma rejects both in one query (ADR 0013).
 */
export const NEGOCIO_ADMIN_SELECT = {
  id: true,
  nombre: true,
  descripcion: true,
  createdAt: true,
  limitTime: true,
  planId: true,
  suspended: true,
  suspendedAt: true,
  creadoPorActivacionLanding: true,
  monedaBase: true,
  monedaFuerte: true,
} satisfies Prisma.NegocioSelect;
