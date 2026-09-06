// `Prisma` is imported as a VALUE and not only as a type: `Prisma.DbNull` is a
// runtime sentinel, and an `import type` would leave it undefined at runtime.
import { Prisma } from "@prisma/client";
import {
  QAB_ORDER_MAX_LINES,
  QAB_ORDER_PULL_PAGE_SIZE_LADDER,
  QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES,
  QAB_ORDER_REJECT_REASONS,
  QAB_ORDER_URL_REQUIRED_PREFIX,
} from "@/constants/qab";
import { fitsQabAmountColumn, fitsQabQuantityColumn } from "@/schemas/qabAmount";
import { compareQabOrderIds, maxQabOrderId } from "@/schemas/qabOrder";
import { qabPulledOrderSchema, readQabOrderId } from "@/schemas/qabOrderPull";
import type {
  IQabOrderLine,
  IQabOrderProposal,
  IQabPulledOrder,
} from "@/schemas/qabOrderPull";

const UTF8 = "utf8";

export type IQabOrderRejectReason = (typeof QAB_ORDER_REJECT_REASONS)[number];

/** One raw element of `orders`, after being looked at once. */
export type IQabOrderParseOutcome =
  | { kind: "ok"; order: IQabPulledOrder }
  /** `qabOrderId` is null ONLY when even the id could not be read. */
  | { kind: "rejected"; qabOrderId: string | null; reason: IQabOrderRejectReason };

/** Every amount of one order that lands in a Decimal(14, 2) column. */
function orderAmounts(order: IQabPulledOrder): string[] {
  const proposal: IQabOrderProposal | null | undefined = order.proposal;
  const amounts = [order.subtotal, order.discountTotal, order.deliveryFee, order.total];

  if (proposal) {
    for (const amount of [
      proposal.previousTotal,
      proposal.subtotal,
      proposal.discountTotal,
      proposal.deliveryFee,
      proposal.total,
    ]) {
      if (amount !== null && amount !== undefined) amounts.push(amount);
    }
  }

  for (const line of order.items) {
    amounts.push(line.unitPrice, line.lineTotal);
    if (line.originalUnitPrice !== null && line.originalUnitPrice !== undefined) {
      amounts.push(line.originalUnitPrice);
    }
    if (line.originalLineTotal !== null && line.originalLineTotal !== undefined) {
      amounts.push(line.originalLineTotal);
    }
  }

  return amounts;
}

/** Serialised size of `rateSnapshot`, which travels to the row untouched. */
function rateSnapshotFits(value: unknown): boolean {
  if (value === undefined || value === null) return true;

  let serialised: string | undefined;
  try {
    serialised = JSON.stringify(value);
  } catch {
    // Not serialisable: it cannot have come from a JSON body, and it cannot be
    // stored either. Refused as oversized rather than thrown.
    return false;
  }
  if (serialised === undefined) return true;

  return Buffer.byteLength(serialised, UTF8) <= QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES;
}

/**
 * Parses ONE raw order and checks everything this side must be able to
 * REPRESENT: the amounts against Decimal(14, 2), the quantities against
 * Decimal(14, 3), the line count, the serialised size of `rateSnapshot`.
 *
 * Never throws. A refusal is about ONE order and never about the page: the other
 * orders of the same batch are written normally (criterion 10). See ADR 0053.
 */
export function parseQabPulledOrder(raw: unknown): IQabOrderParseOutcome {
  const parsed = qabPulledOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return { kind: "rejected", qabOrderId: readQabOrderId(raw), reason: "INVALID_ORDER" };
  }

  const order = parsed.data;

  if (!orderAmounts(order).every(fitsQabAmountColumn)) {
    return { kind: "rejected", qabOrderId: order.id, reason: "AMOUNT_OUT_OF_RANGE" };
  }

  if (!order.items.every((line) => fitsQabQuantityColumn(line.quantity))) {
    return { kind: "rejected", qabOrderId: order.id, reason: "QUANTITY_OUT_OF_RANGE" };
  }

  if (order.items.length > QAB_ORDER_MAX_LINES) {
    return { kind: "rejected", qabOrderId: order.id, reason: "TOO_MANY_LINES" };
  }

  if (!rateSnapshotFits(order.rateSnapshot)) {
    return { kind: "rejected", qabOrderId: order.id, reason: "RATE_SNAPSHOT_TOO_LARGE" };
  }

  // A `customerWhatsappUrl` of any other scheme is dropped here, never rejected:
  // it is a convenience field, and F-011 renders it as a link.
  return {
    kind: "ok",
    order: {
      ...order,
      customerWhatsappUrl: safeCustomerWhatsappUrl(order.customerWhatsappUrl),
    },
  };
}

/**
 * Splits a page. Preserves the wire order in both lists. Total and pure: the
 * page as a whole is never rejected because of one of its orders.
 */
export function partitionQabOrders(raws: ReadonlyArray<unknown>): {
  orders: IQabPulledOrder[];
  rejected: Array<{ qabOrderId: string | null; reason: IQabOrderRejectReason }>;
} {
  const orders: IQabPulledOrder[] = [];
  const rejected: Array<{ qabOrderId: string | null; reason: IQabOrderRejectReason }> = [];

  for (const raw of raws) {
    const outcome = parseQabPulledOrder(raw);
    if (outcome.kind === "ok") {
      orders.push(outcome.order);
    } else {
      rejected.push({ qabOrderId: outcome.qabOrderId, reason: outcome.reason });
    }
  }

  return { orders, rejected };
}

/**
 * The orders of `orders` that are not yet in `existing`, deduplicated WITHIN the
 * list too — the same page can carry the same id twice, which is exactly the
 * anomaly the QAB contract describes for two overlapping pollers. Order preserved.
 *
 * Calling it a second time with the id already in `existing` returns `[]`: that is
 * criterion 4 at its pure level (ADR 0052).
 */
export function selectNewQabOrders(
  existing: ReadonlySet<string>,
  orders: ReadonlyArray<IQabPulledOrder>,
): IQabPulledOrder[] {
  const taken = new Set<string>();
  const fresh: IQabPulledOrder[] = [];

  for (const order of orders) {
    if (existing.has(order.id) || taken.has(order.id)) continue;
    taken.add(order.id);
    fresh.push(order);
  }

  return fresh;
}

/**
 * Cursor advance. Folds `maxQabOrderId` over the current cursor, EVERY id
 * received this page — accepted and rejected alike — and `nextCursor` when it is
 * not null. Monotonic by construction: it can never go backwards, and a gap in
 * the ids is not a condition of any kind (criterion 5).
 *
 * Rejected orders count on purpose: not advancing past one that can never be
 * written blocks every later order of that business forever. See ADR 0053.
 */
export function advanceQabOrderCursor(args: {
  current: string | null;
  /** ReadonlyArray: never mutated, and a fixture built with `as const` has to fit. */
  receivedIds: ReadonlyArray<string | null>;
  nextCursor: string | null;
}): {
  cursor: string | null;
  /**
   * The cursor moved, and `nextCursor` alone is what moved it: it is strictly
   * greater than every id this page delivered. Legitimate — that is how the
   * global BIGINT's gaps are skipped (criterion 5) — and the ONLY trace that it
   * happened. See the asymmetry noted in ADR 0053.
   *
   * An EMPTY page with a non-null `nextCursor` DOES count: "greater than every
   * id delivered" is vacuously true, and that case is the purest instance of
   * what this counter exists to record. A `nextCursor` BEHIND the cursor does
   * NOT: `maxQabOrderId` never goes backwards, so nothing advanced.
   */
  jumped: boolean;
} {
  const { current, receivedIds, nextCursor } = args;

  let cursor = current;
  for (const id of receivedIds) {
    if (id === null) continue;
    cursor = maxQabOrderId(cursor, id);
  }

  if (nextCursor === null) {
    return { cursor, jumped: false };
  }

  const advanced = maxQabOrderId(cursor, nextCursor);
  // Two conditions, and the first one is what the truth table adds to the
  // literal reading: a cursor that did not move was never jumped over. An id
  // that could not be read does not count as delivered.
  const jumped =
    advanced !== current &&
    receivedIds.every((id) => id === null || compareQabOrderIds(nextCursor, id) > 0);

  return { cursor: advanced, jumped };
}

/** `null` unless the value is an `https://` URL: F-011 renders it as a link. */
function safeCustomerWhatsappUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.startsWith(QAB_ORDER_URL_REQUIRED_PREFIX) ? value : null;
}

/**
 * The SQL NULL of a nullable Json column, never a bare `null`, which Prisma
 * reads as ambiguous there. The value itself travels untouched: it was already
 * size-checked while parsing, and it is opaque JSON of the wire.
 */
function toRateSnapshotInput(
  value: unknown,
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined || value === null) return Prisma.DbNull;
  // The cast is the boundary between `unknown` from the wire and Prisma's own
  // JSON input type. It is not an `any`: nothing is dereferenced here.
  return value as Prisma.InputJsonValue;
}

/** One line of the order, written field by field into its nested `create`. */
function toPedidoEntranteLineaCreateData(
  line: IQabOrderLine,
): Prisma.PedidoEntranteLineaUncheckedCreateWithoutPedidoInput {
  return {
    storeProductExternalId: line.storeProductExternalId ?? null,
    name: line.name,
    quantity: line.quantity,
    currencyCode: line.currencyCode,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
    originalCurrencyCode: line.originalCurrencyCode ?? null,
    originalUnitPrice: line.originalUnitPrice ?? null,
    originalLineTotal: line.originalLineTotal ?? null,
  };
}

/**
 * The row to write, key by key. `tiendaId` is ALREADY resolved by the caller and
 * is null unless the store belongs to `negocioId`.
 *
 * Spreading the parsed order in here is FORBIDDEN: every field is written out
 * explicitly, which is what keeps a field the wire grows tomorrow from reaching
 * a column by accident.
 *
 * `deliveryFeePending` is copied VERBATIM from the order. It is never computed
 * from `deliveryFee`, from `total` or from `contact.address` (criterion 2).
 *
 * `rateSnapshot` absent or JSON null yields `Prisma.DbNull` — the SQL NULL —
 * never a bare `null`, which Prisma reads as ambiguous on a nullable Json column.
 */
export function toPedidoEntranteCreateData(args: {
  negocioId: string;
  tiendaId: string | null;
  order: IQabPulledOrder;
  pulledAt: Date;
}): Prisma.PedidoEntranteUncheckedCreateInput {
  const { negocioId, tiendaId, order, pulledAt } = args;
  const contact = order.contact ?? null;
  const proposal = order.proposal ?? null;

  return {
    negocioId,
    qabOrderId: order.id,
    code: order.code,
    storeExternalId: order.storeExternalId,
    tiendaId,
    status: order.status,
    cancelledBy: order.cancelledBy,
    contactName: contact?.name ?? null,
    contactPhone: contact?.phone ?? null,
    contactEmail: contact?.email ?? null,
    contactAddress: contact?.address ?? null,
    currencyCode: order.currencyCode,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    deliveryFeePending: order.deliveryFeePending,
    rateSnapshot: toRateSnapshotInput(order.rateSnapshot),
    notes: order.notes ?? null,
    customerWhatsappUrl: safeCustomerWhatsappUrl(order.customerWhatsappUrl),
    proposalProposedAt: proposal?.proposedAt ?? null,
    proposalExpiresAt: proposal?.expiresAt ?? null,
    proposalPreviousTotal: proposal?.previousTotal ?? null,
    proposalSubtotal: proposal?.subtotal ?? null,
    proposalDiscountTotal: proposal?.discountTotal ?? null,
    proposalDeliveryFee: proposal?.deliveryFee ?? null,
    proposalTotal: proposal?.total ?? null,
    proposalMessage: proposal?.message ?? null,
    qabCreatedAt: order.createdAt,
    pulledAt,
    // Nested on purpose: `pedidoId` and `negocioId` are the two halves of the
    // composite FK and Prisma fills them in. Passing them by hand does not compile.
    lineas: { create: order.items.map(toPedidoEntranteLineaCreateData) },
  };
}

/**
 * PURE. Which page size to ask for after `attempt` RESPONSE_TOO_LARGE answers on
 * the same `since`. Walks QAB_ORDER_PULL_PAGE_SIZE_LADDER and stays on its last
 * value. See ADR 0055.
 */
export function nextQabOrderPageSize(attempt: number): number {
  const ladder = QAB_ORDER_PULL_PAGE_SIZE_LADDER;
  if (!Number.isFinite(attempt)) return ladder[0];

  const step = Math.min(Math.max(Math.trunc(attempt), 0), ladder.length - 1);
  return ladder[step];
}
