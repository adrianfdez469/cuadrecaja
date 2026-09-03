import type { PrismaClientLike } from "@/lib/prisma";
import { enqueueOutboxEvents } from "@/lib/qab/outboxEnqueue";
import type { IOutboxEventoCreate } from "@/schemas/qabOutbox";

/**
 * The `OutboxEvento` half of acceptance criterion 3: a business whose online
 * store switch is off must not accumulate pending changes, token or no token.
 *
 * `enqueueOutboxEvent`/`enqueueOutboxEvents` are NOT touched: they stay what they
 * are, one statement inside the caller's transaction. This guard wraps them, so
 * that F-006 plugs it in by changing one import line and redesigns nothing.
 */

/**
 * Ids (out of the given ones) whose online store switch is on.
 *
 * Same convention as `loadNegocioIdsWithQabToken`, and here the argument is
 * MANDATORY: `[]` = none, with an early return and without touching the database.
 * There is no "every business" form - enqueueing is always for a known set.
 */
export async function loadOnlineStoreEnabledBusinesses(
  tx: PrismaClientLike,
  negocioIds: string[],
): Promise<Set<string>> {
  if (negocioIds.length === 0) return new Set();

  const rows = await tx.negocio.findMany({
    where: { id: { in: negocioIds }, tiendaOnlineHabilitada: true },
    select: { id: true },
  });

  return new Set(rows.map((row) => row.id));
}

/**
 * PURE. Splits the events into those that may be enqueued and those that are
 * dropped. Preserves the input order within each side.
 */
export function partitionOutboxEventsByOnlineStore(
  inputs: IOutboxEventoCreate[],
  enabledNegocioIds: ReadonlySet<string>,
): { allowed: IOutboxEventoCreate[]; skipped: IOutboxEventoCreate[] } {
  const allowed: IOutboxEventoCreate[] = [];
  const skipped: IOutboxEventoCreate[] = [];

  for (const input of inputs) {
    if (enabledNegocioIds.has(input.negocioId)) allowed.push(input);
    else skipped.push(input);
  }

  return { allowed, skipped };
}

/**
 * The entry point F-006 will use INSTEAD OF `enqueueOutboxEvents`.
 * A business with the switch off leaves no row, and that is NOT an error:
 * it returns how many were dropped. `inputs: []` never touches the database.
 */
export async function enqueueOutboxEventsForEnabledBusinesses(
  tx: PrismaClientLike,
  inputs: IOutboxEventoCreate[],
): Promise<{ ids: string[]; skipped: number }> {
  if (inputs.length === 0) return { ids: [], skipped: 0 };

  const negocioIds = [...new Set(inputs.map((input) => input.negocioId))];
  const enabled = await loadOnlineStoreEnabledBusinesses(tx, negocioIds);
  const { allowed, skipped } = partitionOutboxEventsByOnlineStore(inputs, enabled);

  if (allowed.length === 0) return { ids: [], skipped: skipped.length };

  const { ids } = await enqueueOutboxEvents(tx, allowed);
  return { ids, skipped: skipped.length };
}
