import type { Prisma } from "@prisma/client";
import type { PrismaClientLike } from "@/lib/prisma";
import type { INegocioQabSettingsItem } from "@/schemas/qabNegocio";

/**
 * The strong invariant of F-003 (ADR 0024): none of these queries names the
 * server-only token column in a `select`. The boolean is derived with a `where`,
 * which Prisma resolves over an omitted column without returning it (ADR 0013).
 *
 * The token column is deliberately ABSENT from this list and is never added.
 */
export const NEGOCIO_QAB_SELECT = {
  id: true,
  tiendaOnlineHabilitada: true,
  qabTokenActualizadoAt: true,
} satisfies Prisma.NegocioSelect;

export interface INegocioQabRow {
  id: string;
  tiendaOnlineHabilitada: boolean;
  qabTokenActualizadoAt: Date | null;
}

/**
 * PURE. The ONLY function that turns a row into the shape of the wire.
 * It does not receive the token: it receives whether there is one.
 */
export function toNegocioQabSettings(
  row: INegocioQabRow,
  tokenConfigurado: boolean,
): INegocioQabSettingsItem {
  return {
    negocioId: row.id,
    tiendaOnlineHabilitada: row.tiendaOnlineHabilitada,
    qabTokenConfigurado: tokenConfigurado,
    qabTokenActualizadoAt: row.qabTokenActualizadoAt,
  };
}

/**
 * Ids of the businesses that have a token, WITHOUT reading a single one.
 *
 *   - `negocioIds` ABSENT (`undefined`) = "do not filter" -> every business.
 *   - `negocioIds` EMPTY (`[]`) = "filter by this set, which is empty" -> NONE.
 *     Early return with `new Set()`, without touching the database.
 *
 * The early return is deliberate, not an optimisation: if an EMPTY filter behaved
 * like an ABSENT one, the day a caller computes the list and gets nothing back it
 * would receive EVERY business instead of none - the opposite of what it asked
 * for, and in a function that answers "who has a credential" that over-reports.
 * An empty filter never turns into an absent filter.
 */
export async function loadNegocioIdsWithQabToken(
  tx: PrismaClientLike,
  negocioIds?: string[],
): Promise<Set<string>> {
  if (negocioIds !== undefined && negocioIds.length === 0) return new Set();

  const rows = await tx.negocio.findMany({
    where: {
      qabToken: { not: null },
      ...(negocioIds === undefined ? {} : { id: { in: negocioIds } }),
    },
    select: { id: true },
  });

  return new Set(rows.map((row) => row.id));
}
