import type { Prisma } from "@prisma/client";

import {
  TIENDA_ONLINE_ORDER_PAGE_SIZE_DEFAULT,
  TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX,
} from "@/constants/tiendaOnline";
import { prisma } from "@/lib/prisma";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import {
  TIENDA_ONLINE_ORDER_DETAIL_SELECT,
  TIENDA_ONLINE_ORDER_LIST_SELECT,
  toTiendaOnlineOrder,
  toTiendaOnlineOrderListItem,
  unattendedOrdersWhere,
} from "@/lib/tiendaOnline/tiendaOnlineOrderMapping";
import type {
  ITiendaOnlineOrderDetail,
  ITiendaOnlineOrdersPage,
} from "@/schemas/tiendaOnline";

/**
 * The reads of the orders inbox, and its ONE write.
 *
 * `negocioId` is in the `where` of EVERY query, and so is
 * `tiendaId: { in: tiendaIds }` on the three that return orders. The single
 * write — `writeTiendaOnlineOrderStatus`, added by F-012 — carries `negocioId`
 * too, and it is the only statement of this module that changes a row.
 */

/**
 * Acceptance criterion 7. `tiendaIds: []` returns 0 WITHOUT touching the
 * database, the same shape `readExistingQabOrderIds` uses in F-010.
 *
 * Uses `unattendedOrdersWhere`, and nothing here rebuilds that filter.
 */
export async function countUnattendedTiendaOnlineOrders(params: {
  negocioId: string;
  tiendaIds: string[];
}): Promise<number> {
  if (params.tiendaIds.length === 0) return 0;
  return prisma.pedidoEntrante.count({ where: unattendedOrdersWhere(params) });
}

/**
 * Orders of this business with no owning store (`tiendaId: null`), which are in
 * no scope and therefore in no page. The number exists so the fact is visible
 * even though the rows are not (ADR 0056).
 */
export async function countUnassignedTiendaOnlineOrders(
  negocioId: string,
): Promise<number> {
  return prisma.pedidoEntrante.count({
    where: { negocioId, tiendaId: null },
  });
}

/** Bounded page size: the default when absent, the cap when over it. */
function resolveLimit(limit?: number): number {
  if (limit === undefined) return TIENDA_ONLINE_ORDER_PAGE_SIZE_DEFAULT;
  return Math.min(limit, TIENDA_ONLINE_ORDER_PAGE_SIZE_MAX);
}

/**
 * One page of the inbox, newest first.
 *
 * `orderBy: [{ createdAt: "desc" }, { id: "desc" }]`, both columns NOT NULL —
 * ordering by the nullable `qabCreatedAt` would make the keyset comparison drop
 * rows in silence (ADR 0057). `take: limit + 1`, so `nextCursor` is a fact and
 * not a guess.
 *
 * THE KEYSET IS EXPLICIT, and Prisma's `cursor`/`skip` is NOT used. Prisma
 * locates the anchor row by its unique id BEFORE applying the `where`, so the
 * anchor lookup would not be scoped to this business, and what it does with an
 * anchor that does not exist or belongs to someone else is engine behaviour this
 * contract cannot pin down. Instead the anchor is resolved with a `findFirst`
 * that carries the tenancy filter INSIDE it, and an anchor that resolves to
 * `null` — it does not exist, it is another business's, or its store is out of
 * scope — yields THE SAME answer in the three cases: `orders: []` and
 * `nextCursor: null`, with BOTH counters still computed, because neither depends
 * on the anchor. The listing simply ends; it does not restart at the first page
 * and it does not fail.
 *
 * With `tiendaIds: []` the `findMany` and the anchor lookup are not executed at
 * all: the page comes back empty with `nextCursor: null` and
 * `unattendedCount: 0`. `unassignedCount` is still queried, because it does not
 * depend on the scope.
 */
export async function listTiendaOnlineOrders(params: {
  negocioId: string;
  tiendaIds: string[];
  manageableTiendaIds: ReadonlySet<string>;
  cursor?: string;
  limit?: number;
}): Promise<ITiendaOnlineOrdersPage> {
  const { negocioId, tiendaIds, cursor } = params;
  const limit = resolveLimit(params.limit);
  const hasScope = tiendaIds.length > 0;

  let anchor: { id: string; createdAt: Date } | null = null;
  if (cursor !== undefined && hasScope) {
    anchor = await prisma.pedidoEntrante.findFirst({
      where: { id: cursor, negocioId, tiendaId: { in: tiendaIds } },
      select: { id: true, createdAt: true },
    });
  }

  const anchorUnresolved = cursor !== undefined && anchor === null;
  const readsPage = hasScope && !anchorUnresolved;

  // The keyset comparison, and no `skip`.
  const keyset: Prisma.PedidoEntranteWhereInput = anchor
    ? {
        OR: [
          { createdAt: { lt: anchor.createdAt } },
          { createdAt: anchor.createdAt, id: { lt: anchor.id } },
        ],
      }
    : {};

  const [rows, unattendedCount, unassignedCount] = await Promise.all([
    readsPage
      ? prisma.pedidoEntrante.findMany({
          where: { negocioId, tiendaId: { in: tiendaIds }, ...keyset },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          select: TIENDA_ONLINE_ORDER_LIST_SELECT,
        })
      : [],
    countUnattendedTiendaOnlineOrders({ negocioId, tiendaIds }),
    countUnassignedTiendaOnlineOrders(negocioId),
  ]);

  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;

  return {
    negocioId,
    tiendaOnlineHabilitada: true,
    orders: page.map((row) =>
      toTiendaOnlineOrderListItem(row, {
        canManage: params.manageableTiendaIds.has(row.tiendaId ?? ""),
      }),
    ),
    nextCursor,
    unattendedCount,
    unassignedCount,
  };
}

/**
 * One order of this business that is inside `tiendaIds`, or `null`.
 *
 * `null` covers all three refusals at once — the order does not exist, it
 * belongs to another business, or its store is not in the scope — and the route
 * answers the same 404 to the three.
 *
 * Resolved through the composite key `id_negocioId` (ADR 0007), so the tenancy
 * filter cannot be forgotten, and with `tiendaId: { in: tiendaIds }` in the same
 * `where`.
 */
export async function getTiendaOnlineOrderDetail(params: {
  negocioId: string;
  pedidoId: string;
  tiendaIds: string[];
  manageableTiendaIds: ReadonlySet<string>;
}): Promise<ITiendaOnlineOrderDetail | null> {
  const { negocioId, pedidoId, tiendaIds } = params;

  const row = await prisma.pedidoEntrante.findUnique({
    where: {
      id_negocioId: { id: pedidoId, negocioId },
      tiendaId: { in: tiendaIds },
    },
    select: TIENDA_ONLINE_ORDER_DETAIL_SELECT,
  });
  if (row === null) return null;

  return {
    negocioId,
    tiendaOnlineHabilitada: true,
    order: toTiendaOnlineOrder(row, {
      canManage: params.manageableTiendaIds.has(row.tiendaId ?? ""),
    }),
  };
}

/**
 * What the PATCH's gate needs from ONE order of this business. Replaces the
 * store-only read of F-011, which had no other caller.
 */
export interface ITiendaOnlineOrderGateTarget {
  /** NEVER null here: an order with no owning store resolves to `null` below. */
  tiendaId: string;
  qabOrderId: string;
}

/**
 * The owning store and the QAB id of ONE order of this business, or `null`.
 *
 * NOT scoped by `tiendaIds` on purpose: the gate needs to tell an order of a
 * store you are not assigned to (404) apart from one where you lack `.gestionar`
 * (403), and that is what `decideTiendaOnlineOrderManage` decides.
 *
 * Resolved through the composite key `id_negocioId` (ADR 0007), so the tenancy
 * filter cannot be forgotten.
 *
 * Returns `null` for THREE things at once — there is no such order in this
 * business, it belongs to another business, or it exists and has no owning
 * store. Collapsing them HERE, at the lowest level, is what makes them
 * indistinguishable downstream: the gate sees one `null`, answers OUT_OF_SCOPE,
 * and no branch is left that could tell them apart. That is the property F-011
 * decision 2 promises, and it is unchanged by carrying `qabOrderId` along
 * (ADR 0063).
 */
export async function readTiendaOnlineOrderGateTarget(params: {
  negocioId: string;
  pedidoId: string;
}): Promise<ITiendaOnlineOrderGateTarget | null> {
  const row = await prisma.pedidoEntrante.findUnique({
    where: { id_negocioId: { id: params.pedidoId, negocioId: params.negocioId } },
    select: { tiendaId: true, qabOrderId: true },
  });
  if (row === null || row.tiendaId === null) return null;
  return { tiendaId: row.tiendaId, qabOrderId: row.qabOrderId };
}

/**
 * Writes the new status of ONE order of this business. Returns how many rows it
 * changed: 1, or 0 when the row is gone.
 *
 * `updateMany` and not `update`, and the count is the caller's business: an
 * update that matches nothing does NOT fail (E-024), and treating "wrote
 * nothing" as success is exactly the divergence criterion 9 is about.
 *
 * The `where` carries `negocioId` and NOT `tiendaId`: the store scope was
 * already decided by the gate, on this very row, and re-deriving it here would
 * be a second paraphrased copy of that rule (E-014).
 *
 * It has NO policy: it does not catch, it does not log, it does not decide what
 * a 0 means. That lives in `reportTiendaOnlineOrderStatus`.
 */
export async function writeTiendaOnlineOrderStatus(params: {
  negocioId: string;
  pedidoId: string;
  status: IQabOrderStatusReportable;
}): Promise<number> {
  const result = await prisma.pedidoEntrante.updateMany({
    where: { id: params.pedidoId, negocioId: params.negocioId },
    data: { status: params.status },
  });
  return result.count;
}
