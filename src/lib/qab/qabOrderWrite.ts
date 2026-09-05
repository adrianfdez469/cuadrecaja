import type { Prisma } from "@prisma/client";

/**
 * The impure half of the incoming order pull: every statement runs on the `tx`
 * that `withQabOrderPollLock` hands over, never on `prisma` and never on
 * `qabPrisma` directly.
 */

/**
 * The `qabOrderId`s of this business that are ALREADY stored, out of the ones
 * asked about. `qabOrderIds: []` returns an empty Set without touching the
 * database.
 *
 * The `where` carries `negocioId`: a `qabOrderId` that exists in ANOTHER business
 * never counts as present here, so it can never suppress a legitimate order of
 * this one. The wire id is global; the key is not.
 */
export async function readExistingQabOrderIds(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  qabOrderIds: string[];
}): Promise<Set<string>> {
  const { tx, negocioId, qabOrderIds } = args;
  if (qabOrderIds.length === 0) return new Set();

  const rows = await tx.pedidoEntrante.findMany({
    where: { negocioId, qabOrderId: { in: qabOrderIds } },
    select: { qabOrderId: true },
  });

  const present = new Set<string>();
  for (const row of rows) present.add(row.qabOrderId);
  return present;
}

/**
 * `Tienda.id`s among `storeExternalIds` that belong to `negocioId`. ONE query,
 * never one per order. `storeExternalIds: []` returns an empty Set without
 * touching the database.
 *
 * This is where criterion 7's second half lives: two businesses whose stores
 * happen to share a `storeExternalId` value each resolve, at most, the `Tienda`
 * of their OWN `negocioId`.
 */
export async function readOwnTiendaIds(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  storeExternalIds: string[];
}): Promise<Set<string>> {
  const { tx, negocioId, storeExternalIds } = args;
  if (storeExternalIds.length === 0) return new Set();

  const rows = await tx.tienda.findMany({
    where: { negocioId, id: { in: storeExternalIds } },
    select: { id: true },
  });

  const own = new Set<string>();
  for (const row of rows) own.add(row.id);
  return own;
}

/**
 * Creates one order with its lines, in ONE nested `create`. Returns nothing: the
 * caller already knows which orders it asked to create.
 */
export async function insertQabOrder(args: {
  tx: Prisma.TransactionClient;
  data: Prisma.PedidoEntranteUncheckedCreateInput;
}): Promise<void> {
  await args.tx.pedidoEntrante.create({ data: args.data });
}

/**
 * Creates every order of a batch, in order, and returns how many rows it made.
 *
 * It RE-READS which of those `qabOrderId`s are already stored — with
 * `readExistingQabOrderIds`, over `negocioId` — and skips them, EVEN THOUGH the
 * caller already filtered the batch with `selectNewQabOrders`. That is not a
 * redundancy to remove: it is what makes this function idempotent BY ITSELF
 * instead of idempotent only when its caller behaves.
 *
 * The value is not only the test. A retry after a partial failure, or any future
 * second caller, cannot turn into a P2002 that aborts the whole transaction
 * (ADR 0052). And it is what makes level 2 of criterion 4 executable: invoking it
 * twice with the same batch, OUTSIDE `withQabOrderPollLock`, gives `created: 0`
 * the second time — no race to win. The constraint itself is level 3.
 */
export async function insertQabOrders(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  orders: Prisma.PedidoEntranteUncheckedCreateInput[];
}): Promise<{ created: number }> {
  const { tx, negocioId, orders } = args;
  if (orders.length === 0) return { created: 0 };

  const present = await readExistingQabOrderIds({
    tx,
    negocioId,
    qabOrderIds: orders.map((order) => order.qabOrderId),
  });

  let created = 0;
  for (const data of orders) {
    if (present.has(data.qabOrderId)) continue;
    await insertQabOrder({ tx, data });
    created += 1;
  }

  return { created };
}

/**
 * The business's pull cursor, or `null` when it has none yet (and when the row
 * is gone). THE only place this feature reads `Negocio`, and the reason it is a
 * function and not an inline query is that a rule written in prose has nothing a
 * test can hit.
 *
 * The projection is `{ qabUltimoPedidoVisto: true }` and NOTHING else — not even
 * `id`, which is already the `where`. The business's API credential must never
 * appear in it: by ADR 0013 an explicit `select` BEATS the global `omit`, so
 * copying the `select` of `loadQabTokens` and forgetting to strip that key would
 * hand back the real secret instead of `undefined`. The wide type of `qabPrisma`
 * (ADR 0015) means `tsc` would not say a word about it.
 */
export async function readQabOrderCursor(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
}): Promise<string | null> {
  const row = await args.tx.negocio.findUnique({
    where: { id: args.negocioId },
    select: { qabUltimoPedidoVisto: true },
  });

  // `row === null`: the business is gone. A `null` cursor, never a throw.
  return row?.qabUltimoPedidoVisto ?? null;
}

/**
 * Writes the business's cursor. `updateMany` with `{ id: negocioId }`, NEVER an
 * `update` that could touch another row, and never a global value.
 * `cursor === null` writes nothing and returns 0.
 */
export async function advanceQabOrderCursorRow(args: {
  tx: Prisma.TransactionClient;
  negocioId: string;
  cursor: string | null;
}): Promise<number> {
  const { tx, negocioId, cursor } = args;
  if (cursor === null) return 0;

  const result = await tx.negocio.updateMany({
    where: { id: negocioId },
    data: { qabUltimoPedidoVisto: cursor },
  });

  return result.count;
}
