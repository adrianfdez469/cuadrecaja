import type { Prisma } from "@prisma/client";

import type { IOutboxEvento } from "@/schemas/qabOutbox";
import type { IQabStorePayload } from "@/schemas/qabStore";
import type { IQabAppliedStorePublish } from "@/schemas/qabSync";

/** `OutboxEvento.entidad` of a local. The one place this literal is written. */
export const QAB_STORE_ENTITY = "STORE";

/**
 * The payload key the published-signal filters on. Named FROM the payload type,
 * never as a loose literal: if the QAB contract ever renames it, this fails the
 * build instead of silently matching no rows (ADR 0035).
 */
const PUBLISH_TO_STORE_KEY: keyof IQabStorePayload = "publishToStore";

/**
 * `payload.publishToStore === true`, as a Prisma JSON filter. The SINGLE
 * definition in the repository (E-014): `hasEverPublishedToStore`,
 * `readPublishedTiendaIds` and `qabAppliedPublishWhere` all import THIS.
 * Keyed FROM the payload type so a contract rename fails the build.
 */
export const qabPublishedPayloadFilter: Prisma.OutboxEventoWhereInput["payload"] = {
  path: [PUBLISH_TO_STORE_KEY],
  equals: true,
};

/**
 * "A publish of this local WAS ALREADY APPLIED": a STORE event of that local,
 * with `payload.publishToStore: true`, whose `procesadoAt IS NOT NULL`.
 *
 * `negocioId` is ALWAYS in the `where`, never compared afterwards: `Tienda` has
 * no `@@unique([id, negocioId])`.
 */
export function qabAppliedPublishWhere(args: {
  negocioIds: string[];
  tiendaIds: string[];
}): Prisma.OutboxEventoWhereInput {
  return {
    negocioId: { in: args.negocioIds },
    entidad: QAB_STORE_ENTITY,
    entidadId: { in: args.tiendaIds },
    payload: qabPublishedPayloadFilter,
    procesadoAt: { not: null },
  };
}

/** Separator of the dedup key. A character no id can contain. */
const PAIR_KEY_SEPARATOR = " ";

/** `payload.publishToStore === true`, read defensively: the payload is `unknown`. */
function payloadPublished(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return false;
  }
  return (payload as Record<string, unknown>)[PUBLISH_TO_STORE_KEY] === true;
}

/**
 * PURE. The (negocioId, tiendaId) pairs of the STORE events of `rows` that both
 * published (`payload.publishToStore === true`) and were acknowledged
 * (`id ∈ processedIds`). Reads the payload defensively: it is `unknown`.
 * Ids of `processedIds` that do not belong to `rows` are IGNORED, exactly like
 * in `planOutboxAck`. Deduplicated, in the order the rows come.
 */
export function collectQabAppliedStorePublishes(
  rows: IOutboxEvento[],
  processedIds: string[],
): IQabAppliedStorePublish[] {
  const acknowledged = new Set(processedIds);
  const seen = new Set<string>();
  const pairs: IQabAppliedStorePublish[] = [];

  for (const row of rows) {
    if (row.entidad !== QAB_STORE_ENTITY) continue;
    if (!acknowledged.has(row.id)) continue;
    if (!payloadPublished(row.payload)) continue;

    const key = `${row.negocioId}${PAIR_KEY_SEPARATOR}${row.entidadId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ negocioId: row.negocioId, tiendaId: row.entidadId });
  }

  return pairs;
}
