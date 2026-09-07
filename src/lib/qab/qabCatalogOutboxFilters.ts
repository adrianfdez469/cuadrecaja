import {
  QAB_CATEGORY_ENTITY,
  QAB_CURRENCY_ENTITY,
  QAB_EXCHANGE_RATE_ENTITY,
} from "@/constants/qab";
import type { PrismaClientLike } from "@/lib/prisma";
import type { IQabOutboxWithheld } from "@/schemas/qabSync";

/**
 * The reads of the «has this business already synced this?» signal (ADR 0046).
 *
 * All of them carry `negocioId` in the `where` when the question is per
 * business, and NONE deduces tenancy from `entidadId` being a UUID. All of them
 * enter through `@@index([entidad, entidadId])`, and the aggregated ones return
 * at most one row per key however long the history grows.
 *
 * No JSON filter and no new column: `entidadId` is a column THIS feature writes
 * on every emission, so it is not the dead signal of E-013.
 */

/**
 * "Which of these categories has this business ALREADY emitted a CATEGORY event
 * for?" — the lazy-bootstrap signal.
 */
export async function readSyncedCategoriaIds(
  tx: PrismaClientLike,
  args: { negocioId: string; categoriaIds: string[] },
): Promise<Set<string>> {
  if (args.categoriaIds.length === 0) return new Set();

  const rows = await tx.outboxEvento.groupBy({
    by: ["entidadId"],
    where: {
      negocioId: args.negocioId,
      entidad: QAB_CATEGORY_ENTITY,
      entidadId: { in: args.categoriaIds },
    },
  });

  return new Set(rows.map((row) => row.entidadId));
}

/** Same question for CURRENCY, keyed by `Moneda.code`. */
export async function readSyncedCurrencyCodes(
  tx: PrismaClientLike,
  args: { negocioId: string; codes: string[] },
): Promise<Set<string>> {
  if (args.codes.length === 0) return new Set();

  const rows = await tx.outboxEvento.groupBy({
    by: ["entidadId"],
    where: {
      negocioId: args.negocioId,
      entidad: QAB_CURRENCY_ENTITY,
      entidadId: { in: args.codes },
    },
  });

  return new Set(rows.map((row) => row.entidadId));
}

/** Same question for EXCHANGE_RATE, keyed by `TasaCambio.monedaCode`. */
export async function readSyncedExchangeRateCodes(
  tx: PrismaClientLike,
  args: { negocioId: string; codes: string[] },
): Promise<Set<string>> {
  if (args.codes.length === 0) return new Set();

  const rows = await tx.outboxEvento.groupBy({
    by: ["entidadId"],
    where: {
      negocioId: args.negocioId,
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: { in: args.codes },
    },
  });

  return new Set(rows.map((row) => row.entidadId));
}

/**
 * Businesses that must receive the cascade of a GLOBAL category: those with the
 * online store ENABLED that have ALREADY emitted a CATEGORY event for this
 * category. Both conditions matter — the switch, because the drain skips a
 * disabled business's rows (ADR 0021) and they would pile up pending forever;
 * the prior event, because a business that never synced it has nothing to update
 * and its lazy bootstrap will cover it.
 *
 * Ordered by `negocioId` ascending and capped at `limit`. `truncated` says the
 * cap was reached; the route turns it into a field of the 200, never silence.
 */
export async function readQabCategoryCarriers(
  tx: PrismaClientLike,
  args: { categoriaId: string; limit: number },
): Promise<{ negocioIds: string[]; truncated: boolean }> {
  const rows = await tx.negocio.findMany({
    where: {
      tiendaOnlineHabilitada: true,
      outboxEventos: {
        some: {
          entidad: QAB_CATEGORY_ENTITY,
          entidadId: args.categoriaId,
        },
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
    // One more than the cap, so «there were more» is a fact and not a guess.
    take: args.limit + 1,
  });

  return {
    negocioIds: rows.slice(0, args.limit).map((row) => row.id),
    truncated: rows.length > args.limit,
  };
}

/**
 * How many events of each WITHHELD entity are waiting, and since when. One entry
 * per entity with at least one pending event, sorted ascending by `entidad`.
 * `entidades: []` returns `[]` without touching the database.
 *
 * Not scoped by business ON PURPOSE: the drain is a platform-wide cron and this
 * is a queue-health figure, not tenant data. It carries no `negocioId`, no
 * `entidadId` and no payload — an entity name, a count and one instant.
 */
export async function readQabWithheldOutboxPending(
  tx: PrismaClientLike,
  args: { entidades: readonly string[] },
): Promise<IQabOutboxWithheld[]> {
  if (args.entidades.length === 0) return [];

  const rows = await tx.outboxEvento.groupBy({
    by: ["entidad"],
    where: { procesadoAt: null, entidad: { in: [...args.entidades] } },
    _count: { _all: true },
    _min: { ocurridoAt: true },
  });

  return rows
    .map((row) => ({
      entidad: row.entidad,
      pending: row._count._all,
      oldestOcurridoAt: row._min.ocurridoAt ?? null,
    }))
    .sort((left, right) => (left.entidad < right.entidad ? -1 : left.entidad > right.entidad ? 1 : 0));
}

/**
 * Businesses that can carry a CURRENCY emission of the GLOBAL `Moneda` row:
 * those with the online store ENABLED that have this currency enabled
 * (`NegocioMoneda.activo = true`) OR have already emitted a CURRENCY event for
 * it. Ordered by `negocioId` ascending and capped at `limit`.
 */
export async function readQabCurrencyCarriers(
  tx: PrismaClientLike,
  args: { code: string; limit: number },
): Promise<{ negocioIds: string[]; truncated: boolean }> {
  const rows = await tx.negocio.findMany({
    where: {
      tiendaOnlineHabilitada: true,
      OR: [
        {
          negociosMoneda: {
            some: { monedaCode: args.code, activo: true },
          },
        },
        {
          outboxEventos: {
            some: { entidad: QAB_CURRENCY_ENTITY, entidadId: args.code },
          },
        },
      ],
    },
    select: { id: true },
    orderBy: { id: "asc" },
    take: args.limit + 1,
  });

  return {
    negocioIds: rows.slice(0, args.limit).map((row) => row.id),
    truncated: rows.length > args.limit,
  };
}
