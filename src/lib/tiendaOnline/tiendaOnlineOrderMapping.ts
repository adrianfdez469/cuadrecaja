import type { Prisma } from "@prisma/client";

import { QAB_AMOUNT_DECIMALS, QAB_QUANTITY_DECIMALS } from "@/constants/qab";
import {
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_UNATTENDED_STATUS,
} from "@/constants/tiendaOnline";
import { convertQabAmount } from "@/lib/qab/qabRateConversion";
import { parseQabRateSnapshot } from "@/schemas/qabRateSnapshot";
import type { IQabRateSnapshot } from "@/schemas/qabRateSnapshot";
import { toSafeWhatsappUrl } from "@/schemas/qabWhatsappUrl";
import type {
  ITiendaOnlineOrder,
  ITiendaOnlineOrderAmounts,
  ITiendaOnlineOrderLine,
  ITiendaOnlineOrderLineOriginal,
  ITiendaOnlineOrderListItem,
} from "@/schemas/tiendaOnline";

/**
 * The `select`s, the `where` of the counter and the mappers of the orders inbox.
 *
 * PURE: it imports `@prisma/client` ONLY as a type, so the suite can load it
 * without dragging the client along (E-015). Nothing here opens a connection and
 * nothing here writes.
 */

/** Explicit select, never the whole row (ADR 0013, ADR 0019). */
export const TIENDA_ONLINE_ORDER_LIST_SELECT = {
  id: true,
  code: true,
  qabOrderId: true,
  tiendaId: true,
  tienda: { select: { nombre: true } },
  status: true,
  cancelledBy: true,
  contactName: true,
  currencyCode: true,
  subtotal: true,
  discountTotal: true,
  deliveryFee: true,
  total: true,
  deliveryFeePending: true,
  qabCreatedAt: true,
  createdAt: true,
  _count: { select: { lineas: true } },
} satisfies Prisma.PedidoEntranteSelect;

/**
 * Same, plus what only the detail shows.
 *
 * The columns this feature must NOT expose are named nowhere in this file, not
 * even in a comment saying they are excluded: a `grep` for one of them has to
 * come back empty, and F-010 already learned that a contract's example comment
 * ends up copied into `src/` verbatim (E-010). The contract's § 0.1 is where the
 * list lives; they belong to F-012.
 */
export const TIENDA_ONLINE_ORDER_DETAIL_SELECT = {
  id: true,
  code: true,
  qabOrderId: true,
  tiendaId: true,
  tienda: { select: { nombre: true } },
  status: true,
  cancelledBy: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  contactAddress: true,
  customerWhatsappUrl: true,
  notes: true,
  currencyCode: true,
  subtotal: true,
  discountTotal: true,
  deliveryFee: true,
  total: true,
  deliveryFeePending: true,
  rateSnapshot: true,
  qabCreatedAt: true,
  createdAt: true,
  lineas: {
    // Deterministic: every row of one pull shares `createdAt` (it is the
    // transaction timestamp), so `id` is what actually settles the order.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      quantity: true,
      currencyCode: true,
      unitPrice: true,
      lineTotal: true,
      originalCurrencyCode: true,
      originalUnitPrice: true,
      originalLineTotal: true,
    },
  },
} satisfies Prisma.PedidoEntranteSelect;

export type ITiendaOnlineOrderListRow = Prisma.PedidoEntranteGetPayload<{
  select: typeof TIENDA_ONLINE_ORDER_LIST_SELECT;
}>;
export type ITiendaOnlineOrderDetailRow = Prisma.PedidoEntranteGetPayload<{
  select: typeof TIENDA_ONLINE_ORDER_DETAIL_SELECT;
}>;
export type ITiendaOnlineOrderLineRow =
  ITiendaOnlineOrderDetailRow["lineas"][number];

/** PURE. A Decimal(14, 2) as a fixed-scale string of QAB_AMOUNT_DECIMALS decimals. */
export function toAmountString(value: Prisma.Decimal): string {
  return value.toFixed(QAB_AMOUNT_DECIMALS);
}

/** PURE. A Decimal(14, 3) as a fixed-scale string of QAB_QUANTITY_DECIMALS decimals. */
export function toQuantityString(value: Prisma.Decimal): string {
  return value.toFixed(QAB_QUANTITY_DECIMALS);
}

/**
 * PURE. THE definition of "unattended", status half:
 * `status === TIENDA_ONLINE_UNATTENDED_STATUS`. The listing's per-row flag and
 * the counter both call this; nobody rewrites the comparison (ADR 0058, E-014).
 */
export function isUnattendedOrderStatus(status: string): boolean {
  return status === TIENDA_ONLINE_UNATTENDED_STATUS;
}

/**
 * PURE. THE `where` of "unattended", both halves together and in ONE place:
 * `negocioId`, `tiendaId: { in: tiendaIds }` and the status constant.
 *
 * `negocioId` is redundant — `tiendaIds` already came out filtered by business —
 * and it is there anyway: it makes the query visibly multi-tenant where it is
 * read, and it is what the `(negocioId, status)` index is on.
 */
export function unattendedOrdersWhere(params: {
  negocioId: string;
  tiendaIds: string[];
}): Prisma.PedidoEntranteWhereInput {
  return {
    negocioId: params.negocioId,
    tiendaId: { in: params.tiendaIds },
    status: TIENDA_ONLINE_UNATTENDED_STATUS,
  };
}

/**
 * PURE. The amounts of one order, and the ONLY place `kind` is derived. `kind`
 * comes from `deliveryFeePending` and from nothing else — never from comparing
 * amounts, never from `contactAddress` (ADR 0059).
 *
 * QUOTED carries `deliveryFee` and `total`; PENDING_QUOTE carries neither, and
 * carries `partialTotal` instead.
 */
export function toTiendaOnlineOrderAmounts(row: {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  deliveryFee: Prisma.Decimal;
  total: Prisma.Decimal;
  deliveryFeePending: boolean;
}): ITiendaOnlineOrderAmounts {
  const subtotal = toAmountString(row.subtotal);
  const discountTotal = toAmountString(row.discountTotal);

  if (row.deliveryFeePending) {
    return {
      kind: TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote,
      subtotal,
      discountTotal,
      partialTotal: toAmountString(row.total),
    };
  }

  return {
    kind: TIENDA_ONLINE_ORDER_AMOUNT_KIND.quoted,
    subtotal,
    discountTotal,
    deliveryFee: toAmountString(row.deliveryFee),
    total: toAmountString(row.total),
  };
}

/** The original block of a line, or `null` when the row does not carry one. */
function toOrderLineOriginal(
  line: ITiendaOnlineOrderLineRow,
): ITiendaOnlineOrderLineOriginal | null {
  if (line.originalCurrencyCode === null || line.originalUnitPrice === null) {
    return null;
  }
  return {
    currencyCode: line.originalCurrencyCode,
    unitPrice: toAmountString(line.originalUnitPrice),
    lineTotal:
      line.originalLineTotal === null
        ? null
        : toAmountString(line.originalLineTotal),
  };
}

/**
 * PURE. One line, with its original block and its conversion.
 *
 * `original` is non-null only when the row has BOTH `originalCurrencyCode` and
 * `originalUnitPrice`. `conversion` is non-null only when `original` is, the
 * `snapshot` is not null, and `convertQabAmount` returns a value; the target is
 * the LINE's `currencyCode`, not the order's.
 */
export function toTiendaOnlineOrderLine(
  line: ITiendaOnlineOrderLineRow,
  snapshot: IQabRateSnapshot | null,
): ITiendaOnlineOrderLine {
  const unitPrice = toAmountString(line.unitPrice);
  const original = toOrderLineOriginal(line);

  const recomputedUnitPrice =
    original === null || snapshot === null
      ? null
      : convertQabAmount({
          snapshot,
          amount: original.unitPrice,
          fromCurrencyCode: original.currencyCode,
          toCurrencyCode: line.currencyCode,
        });

  return {
    id: line.id,
    name: line.name,
    quantity: toQuantityString(line.quantity),
    currencyCode: line.currencyCode,
    unitPrice,
    lineTotal: toAmountString(line.lineTotal),
    original,
    conversion:
      recomputedUnitPrice === null
        ? null
        : {
            recomputedUnitPrice,
            // Exact equality of two fixed-scale strings, with no tolerance.
            matchesStored: recomputedUnitPrice === unitPrice,
          },
  };
}

/**
 * The fields the listing row and the detail share.
 *
 * `tiendaId` and `tienda` are declared nullable by Prisma even though both
 * queries already filtered by `tiendaId: { in: tiendaIds }`. A null is mapped to
 * the empty string, which the `.strict()` validation of the response turns into
 * a schema failure that leaves through the route's fixed log constant — never
 * through an exception carrying the row's `id` or `code` (ADR 0061).
 */
function toOrderCommonFields(
  row: ITiendaOnlineOrderListRow | ITiendaOnlineOrderDetailRow,
  args: { canManage: boolean },
) {
  return {
    id: row.id,
    code: row.code,
    qabOrderId: row.qabOrderId,
    tiendaId: row.tiendaId ?? "",
    tiendaNombre: row.tienda?.nombre ?? "",
    status: row.status,
    cancelledBy: row.cancelledBy,
    unattended: isUnattendedOrderStatus(row.status),
    contactName: row.contactName,
    currencyCode: row.currencyCode,
    amounts: toTiendaOnlineOrderAmounts(row),
    qabCreatedAt: row.qabCreatedAt === null ? null : row.qabCreatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    canManage: args.canManage,
  };
}

/** PURE. One row of the listing. `tiendaId` of the row is never null here. */
export function toTiendaOnlineOrderListItem(
  row: ITiendaOnlineOrderListRow,
  args: { canManage: boolean },
): ITiendaOnlineOrderListItem {
  return {
    ...toOrderCommonFields(row, args),
    lineCount: row._count.lineas,
  };
}

/** PURE. The full order. Parses `rateSnapshot` once and reuses it for every line. */
export function toTiendaOnlineOrder(
  row: ITiendaOnlineOrderDetailRow,
  args: { canManage: boolean },
): ITiendaOnlineOrder {
  const snapshot = parseQabRateSnapshot(row.rateSnapshot);

  return {
    ...toOrderCommonFields(row, args),
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    contactAddress: row.contactAddress,
    // The exit guard, never the raw column: it checks the HOST and not only the
    // scheme, and a row that does not pass becomes `null` instead of failing the
    // whole detail response (ADR 0066).
    customerWhatsappUrl: toSafeWhatsappUrl(row.customerWhatsappUrl),
    notes: row.notes,
    rateSnapshot:
      snapshot === null
        ? null
        : { base: snapshot.base, capturedAt: snapshot.capturedAt ?? null },
    lines: row.lineas.map((line) => toTiendaOnlineOrderLine(line, snapshot)),
  };
}
