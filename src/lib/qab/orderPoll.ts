// `Prisma` is imported as a VALUE and not only as a type: `qabOrderPullErrorCode`
// needs `Prisma.PrismaClientKnownRequestError` at runtime, and an `import type`
// gives the type without the class.
import { Prisma } from "@prisma/client";
import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_ORDER_PULL_BUDGET_MS,
  QAB_ORDER_PULL_LOG,
  QAB_ORDER_PULL_MAX_PAGES_PER_RUN,
  QAB_ORDER_PULL_OUTCOMES,
  QAB_ORDER_PULL_PAGE_SIZE_LADDER,
  QAB_ORDER_PULL_REJECTED_LOG,
  QAB_ORDER_PULL_UNKNOWN_ERROR_CODE,
} from "@/constants/qab";
import { fetchQabOrdersPage } from "@/lib/qab/qabOrderClient";
import type { IQabOrderFetchOutcome } from "@/lib/qab/qabOrderClient";
import {
  advanceQabOrderCursor,
  nextQabOrderPageSize,
  partitionQabOrders,
  selectNewQabOrders,
  toPedidoEntranteCreateData,
} from "@/lib/qab/qabOrderPullPlan";
import {
  advanceQabOrderCursorRow,
  insertQabOrders,
  readExistingQabOrderIds,
  readOwnTiendaIds,
} from "@/lib/qab/qabOrderWrite";
import { qabOrderTotalsAreConsistent } from "@/schemas/qabOrderPull";

/** Log tags of the order-poll slot. They are the executable evidence of criterion 6. */
export const QAB_ORDER_POLL_ENTER_LOG = "qab.orderPoll.enter";
export const QAB_ORDER_POLL_SKIPPED_LOG = "qab.orderPoll.skipped";
export const QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD = "lock_held";

/** Written in a log line in place of an id that could not be read. */
const UNKNOWN_ORDER_ID = "unknown";
/** Written in a log line in place of a cursor the business does not have yet. */
const NO_CURSOR = "none";

export type IQabOrderPullOutcome = (typeof QAB_ORDER_PULL_OUTCOMES)[number];

export interface IQabOrderPullArgs {
  tx: Prisma.TransactionClient;
  negocioId: string;
  token: string;
  baseUrl: string;
  /** The business's cursor, read by the caller. `null` on its first ever pull. */
  cursor: string | null;
  /** Defaults to `Date.now() + QAB_ORDER_PULL_BUDGET_MS`, fixed on entry. */
  deadlineAt?: number;
  /** Injected so the pull can be exercised without a network. */
  fetchPage?: (args: {
    since: string | null;
    limit: number;
  }) => Promise<IQabOrderFetchOutcome>;
  /** Fixed once per business so every row of a run shares it. Defaults to `new Date()`. */
  pulledAt?: Date;
}

export interface IQabOrderPullReport {
  /** Rows actually created. */
  pulled: number;
  /** true now that F-010 filled the slot. The no-token branch of the cron keeps false. */
  implemented: boolean;
  /** HTTP requests issued, ladder retries included. */
  pages: number;
  /** Orders the wire delivered this run, rejected ones included. */
  received: number;
  /** Already stored, not rewritten. */
  duplicates: number;
  /** Refused because this side cannot represent them (ADR 0053). */
  rejected: number;
  /** Stored, but neither of the two identities holds. Never a refusal. */
  inconsistentTotals: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  /**
   * Pages whose `nextCursor` moved the cursor past every id delivered. Not an
   * error and not a refusal: the only visible trace that the cursor advanced on
   * the third party's word alone. See ADR 0053.
   */
  cursorJumps: number;
  /** true when the run stopped with a non-null `nextCursor` still pending. */
  moreAvailable: boolean;
  outcome: IQabOrderPullOutcome;
}

/**
 * A report with every counter at zero, for the branches of the cron loop that
 * never reach the slot: no token, lock held, out of phase budget, or a slot that
 * threw.
 */
export function emptyQabOrderPullReport(
  outcome: IQabOrderPullOutcome,
): IQabOrderPullReport {
  return {
    pulled: 0,
    implemented: false,
    pages: 0,
    received: 0,
    duplicates: 0,
    rejected: 0,
    inconsistentTotals: 0,
    cursorBefore: null,
    cursorAfter: null,
    cursorJumps: 0,
    moreAvailable: false,
    outcome,
  };
}

/**
 * PURE. The Prisma error code of a thrown value, or
 * QAB_ORDER_PULL_UNKNOWN_ERROR_CODE. The `instanceof` guard is what makes the
 * result structurally a short code such as "P2028" and never free text: this
 * function has no branch that can return `error.message` or `String(error)`.
 */
export function qabOrderPullErrorCode(error: unknown): string {
  return error instanceof Prisma.PrismaClientKnownRequestError
    ? error.code
    : QAB_ORDER_PULL_UNKNOWN_ERROR_CODE;
}

/**
 * F-002 built the slot; F-010 fills it with GET /api/internal/orders, the cursor
 * advance on `Negocio.qabUltimoPedidoVisto` and the `PedidoEntrante` writes. It
 * runs INSIDE the transaction `withQabOrderPollLock` opened, and every statement
 * goes through that `tx`.
 *
 * It logs exactly one line on entry — that log is what makes F-002's criterion 6
 * verifiable: with two concurrent runs it must appear ONCE per business — and one
 * summary line per business, plus one line per refused order. Ids and counts
 * only: never a body, never the token, and NEVER an `Order.code`.
 *
 * It never throws on the HTTP path, because `fetchQabOrdersPage` never rejects.
 * The DATABASE path can throw, and it is not caught here on purpose: by then the
 * Postgres transaction is already aborted and any later statement would fail too.
 * That exception is isolated by the cron loop, one business at a time.
 */
export async function pullQabOrders(args: IQabOrderPullArgs): Promise<IQabOrderPullReport> {
  const { tx, negocioId, token, baseUrl } = args;
  console.log(`${QAB_ORDER_POLL_ENTER_LOG} negocioId=${negocioId}`);

  // Fixed ONCE on entry: every row of this business shares the same `pulledAt`,
  // and the budget cannot drift page by page.
  const pulledAt = args.pulledAt ?? new Date();
  const deadlineAt = args.deadlineAt ?? Date.now() + QAB_ORDER_PULL_BUDGET_MS;
  const fetchPage =
    args.fetchPage ??
    (({ since, limit }) => fetchQabOrdersPage({ baseUrl, token, since, limit }));

  const report: IQabOrderPullReport = {
    pulled: 0,
    implemented: true,
    pages: 0,
    received: 0,
    duplicates: 0,
    rejected: 0,
    inconsistentTotals: 0,
    cursorBefore: args.cursor,
    cursorAfter: args.cursor,
    cursorJumps: 0,
    moreAvailable: false,
    outcome: "ok",
  };

  let cursor = args.cursor;
  let tooLargeCount = 0;

  for (let attempt = 0; attempt < QAB_ORDER_PULL_MAX_PAGES_PER_RUN; attempt += 1) {
    // "Does a WHOLE page fit in what is left?", not "is there any time left?":
    // the second one authorises precisely the call that blows the budget.
    if (Date.now() + QAB_HTTP_TIMEOUT_MS > deadlineAt) break;

    // `since` is ALWAYS this business's own cursor, never a global value and
    // never another business's (criterion 7).
    const outcome = await fetchPage({
      since: cursor,
      limit: nextQabOrderPageSize(tooLargeCount),
    });
    report.pages += 1;

    if (outcome.kind === "error") {
      // Only a RESPONSE_TOO_LARGE walks down the ladder, and always over the
      // SAME `since`: shrinking the page does not fix a 401 (ADR 0055).
      if (!outcome.tooLarge) {
        report.outcome = "error";
        break;
      }
      tooLargeCount += 1;
      if (tooLargeCount >= QAB_ORDER_PULL_PAGE_SIZE_LADDER.length) {
        report.outcome = "error";
        break;
      }
      continue;
    }

    const { orders: raws, nextCursor } = outcome.page;
    const { orders, rejected } = partitionQabOrders(raws);

    report.received += raws.length;
    report.rejected += rejected.length;
    for (const refusal of rejected) {
      console.log(
        `${QAB_ORDER_PULL_REJECTED_LOG} negocioId=${negocioId} qabOrderId=${refusal.qabOrderId ?? UNKNOWN_ORDER_ID} reason=${refusal.reason}`,
      );
    }

    const receivedIds: Array<string | null> = [
      ...orders.map((order) => order.id),
      ...rejected.map((refusal) => refusal.qabOrderId),
    ];
    const advanced = advanceQabOrderCursor({ current: cursor, receivedIds, nextCursor });

    // A non-empty page with NO readable id and NO `nextCursor` leaves the cursor
    // exactly where it was: there is nothing to advance past. Nothing is written
    // and the next run retries it, which is the correct outcome. Rare, not
    // impossible — and deliberately narrow: a page that re-delivers orders we
    // already have DOES have readable ids, and is a batch of duplicates, not this.
    const unreadablePage =
      raws.length > 0 && nextCursor === null && receivedIds.every((id) => id === null);
    if (unreadablePage) {
      report.outcome = "error";
      break;
    }

    for (const order of orders) {
      if (!qabOrderTotalsAreConsistent(order)) report.inconsistentTotals += 1;
    }

    const ownTiendaIds = await readOwnTiendaIds({
      tx,
      negocioId,
      storeExternalIds: orders.map((order) => order.storeExternalId),
    });
    const existing = await readExistingQabOrderIds({
      tx,
      negocioId,
      qabOrderIds: orders.map((order) => order.id),
    });

    const fresh = selectNewQabOrders(existing, orders);
    report.duplicates += orders.length - fresh.length;

    const rows = fresh.map((order) =>
      toPedidoEntranteCreateData({
        negocioId,
        // Resolved ONLY inside this business: a `storeExternalId` that names a
        // store of another one leaves `tiendaId` null (criterion 7).
        tiendaId: ownTiendaIds.has(order.storeExternalId) ? order.storeExternalId : null,
        order,
        pulledAt,
      }),
    );

    const { created } = await insertQabOrders({ tx, negocioId, orders: rows });
    report.pulled += created;

    if (advanced.jumped) report.cursorJumps += 1;

    // The cursor is written at the END OF EACH PAGE, not at the end of the run:
    // a business that stops halfway does not repeat what it already did. The one
    // exception is an empty page with `nextCursor: null` — the business is up to
    // date and its cursor is not touched at all.
    cursor = advanced.cursor;
    report.cursorAfter = cursor;
    const upToDateAndEmpty = raws.length === 0 && nextCursor === null;
    if (!upToDateAndEmpty) {
      await advanceQabOrderCursorRow({ tx, negocioId, cursor });
    }

    // `nextCursor: null` means "up to date". Not an error, not a special case.
    if (nextCursor === null) {
      report.moreAvailable = false;
      break;
    }
    report.moreAvailable = true;
  }

  console.log(
    `${QAB_ORDER_PULL_LOG} negocioId=${negocioId} pages=${report.pages} received=${report.received} created=${report.pulled} duplicates=${report.duplicates} rejected=${report.rejected} inconsistent=${report.inconsistentTotals} cursorJumps=${report.cursorJumps} cursor=${report.cursorAfter ?? NO_CURSOR} more=${report.moreAvailable} outcome=${report.outcome}`,
  );

  return report;
}
