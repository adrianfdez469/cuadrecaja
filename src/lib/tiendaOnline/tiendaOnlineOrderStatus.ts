import type { QAB_ORDER_STATUSES } from "@/constants/qab";
import {
  QAB_ORDER_STATUS_REPORTABLE,
  QAB_ORDER_STATUS_SEQUENCE,
} from "@/constants/qab";
import {
  TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN,
  TIENDA_ONLINE_ORDER_STATUS_DIVERGED_LOG,
  TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
  TIENDA_ONLINE_ORDER_TRANSITION_BLOCKS,
} from "@/constants/tiendaOnline";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";

/**
 * The product rules of changing an order's status, and the line written when the
 * local write did not land.
 *
 * PURE: no Prisma, no React, and a `.ts` so the suite can import it (E-015).
 * See ADR 0063 and ADR 0065.
 */

export type IOrderTransitionBlock =
  (typeof TIENDA_ONLINE_ORDER_TRANSITION_BLOCKS)[number];

export interface IOrderTransitionOffer {
  /** In sequence order, then CANCELLED, then REJECTED_BY_STORE. */
  targets: IQabOrderStatusReportable[];
  /** Why there is nothing to offer. INVARIANT: null <=> targets.length > 0. */
  blocked: IOrderTransitionBlock | null;
}

/**
 * The one state that branches off the sequence instead of walking along it.
 * Typed against the contract's vocabulary so a typo does not compile.
 */
const AWAITING_CUSTOMER_STATUS =
  "AWAITING_CUSTOMER" satisfies (typeof QAB_ORDER_STATUSES)[number];

const SEQUENCE: readonly string[] = QAB_ORDER_STATUS_SEQUENCE;
const REPORTABLE: readonly string[] = QAB_ORDER_STATUS_REPORTABLE;

/**
 * The two destinations that are reportable and are NOT steps of the sequence,
 * derived from the two constants instead of listed again: CANCELLED and
 * REJECTED_BY_STORE, in the order the vocabulary declares them.
 */
const EXTRA_TARGETS: IQabOrderStatusReportable[] =
  QAB_ORDER_STATUS_REPORTABLE.filter((status) => !SEQUENCE.includes(status));

/**
 * A status from which nothing else can be offered: the END of the sequence plus
 * the two extras. Derived, so adding a step to the sequence moves this too.
 */
const TERMINAL_STATUSES: readonly string[] = [
  SEQUENCE[SEQUENCE.length - 1],
  ...EXTRA_TARGETS,
];

function isReportableStatus(status: string): status is IQabOrderStatusReportable {
  return REPORTABLE.includes(status);
}

/**
 * PURE. Which status changes this screen offers for an order sitting at
 * `currentStatus`. THE definition, and the only one: nothing else re-derives
 * "is it terminal" or "can it still move" (E-014).
 *
 * The rules, and there are no others (E-032):
 *
 *   DELIVERED | CANCELLED | REJECTED_BY_STORE -> [] , "TERMINAL"
 *   AWAITING_CUSTOMER                         -> [] , "AWAITING_CUSTOMER"
 *   PULLED | CONFIRMED | READY | IN_TRANSIT   -> every value STRICTLY LATER in
 *                                                QAB_ORDER_STATUS_SEQUENCE, in
 *                                                order, then CANCELLED, then
 *                                                REJECTED_BY_STORE ; null
 *   anything else, PENDING included           -> [] , "UNKNOWN_STATUS"
 *
 * Skipping forward is allowed (PULLED offers DELIVERED); going back is not.
 * `AWAITING_CUSTOMER` is in neither the sequence nor the two extras, so it can
 * never appear in `targets` from any origin — criterion 13 holds by shape.
 *
 * `currentStatus` is an OPEN string because the column is free text (ADR 0004).
 * No exhaustive `switch`, and a tenth value QAB adds tomorrow lands in the last
 * row instead of breaking the screen.
 */
export function offerOrderStatusTransitions(
  currentStatus: string,
): IOrderTransitionOffer {
  if (TERMINAL_STATUSES.includes(currentStatus)) {
    return { targets: [], blocked: "TERMINAL" };
  }
  if (currentStatus === AWAITING_CUSTOMER_STATUS) {
    return { targets: [], blocked: "AWAITING_CUSTOMER" };
  }

  const position = SEQUENCE.indexOf(currentStatus);
  if (position < 0) return { targets: [], blocked: "UNKNOWN_STATUS" };

  // Walked over the SEQUENCE and not over the reportable list, so the order of
  // the offer is the order of the sequence and not a coincidence of how the two
  // vocabularies happen to be written. `PULLED` is the only step that is not
  // reportable, and it can only sit at or before `position`.
  const forward: IQabOrderStatusReportable[] = [];
  for (const status of QAB_ORDER_STATUS_SEQUENCE.slice(position + 1)) {
    if (isReportableStatus(status)) forward.push(status);
  }
  return { targets: [...forward, ...EXTRA_TARGETS], blocked: null };
}

/**
 * PURE. The one line written when QAB accepted and the local write did not land
 * (acceptance criterion 9).
 *
 * It takes THESE THREE and nothing else. The order's public code and the third
 * party's id are not parameters, so no future edit can slip one in without
 * changing the signature — which is the difference between a structural
 * guarantee and a promise (E-031). `status` is safe to interpolate: it is one of
 * our own six literals, already validated, never free text from the wire.
 */
export function orderStatusDivergedLogLine(params: {
  pedidoId: string;
  status: IQabOrderStatusReportable;
  cause: string;
}): string {
  return `${TIENDA_ONLINE_ORDER_STATUS_DIVERGED_LOG} pedidoId=${params.pedidoId} status=${params.status} cause=${params.cause}`;
}

/**
 * PURE. The `cause` of a failed local write, taken from a thrown value.
 *
 * Returns the value's `code` property ONLY when it is a string matching
 * TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN — a Prisma `P2025` and its siblings —
 * and TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE otherwise.
 *
 * It NEVER reads `message`. A driver-level error quotes the value that broke it
 * in there, and this string goes straight to a log line (E-031). The pattern is
 * what keeps an unbounded or free-form `code` out of the same line.
 */
export function orderStatusWriteFailureCause(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE;
  }

  const code = (error as { code?: unknown }).code;
  if (
    typeof code === "string" &&
    TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN.test(code)
  ) {
    return code;
  }
  return TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE;
}
