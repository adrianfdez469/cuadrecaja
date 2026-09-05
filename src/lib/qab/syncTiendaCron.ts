import {
  QAB_AVAILABILITY_DEADLINE_MS,
  QAB_HTTP_TIMEOUT_MS,
  QAB_ORDER_POLL_PHASE_DEADLINE_MS,
  QAB_ORDER_PULL_BUDGET_MS,
  QAB_ORDER_PULL_FAILED_LOG,
  QAB_SLUG_LEARN_DEADLINE_MS,
  QAB_SYNC_RUN_DEADLINE_MS,
  QAB_SYNC_SKIPPED_NO_BASE_URL,
} from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import {
  emptyQabOutboxDrainReport,
  emptyQabSlugLearnPhaseReport,
} from "@/lib/qab/outboxAck";
import { syncQabAvailability } from "@/lib/qab/availabilitySync";
import { postQabAvailabilityBatch } from "@/lib/qab/qabAvailabilityClient";
import { emptyQabAvailabilityPhaseReport } from "@/lib/qab/qabAvailabilityPlan";
import { drainQabOutbox, loadQabTokens } from "@/lib/qab/outboxDrain";
import {
  QAB_ORDER_POLL_SKIPPED_LOG,
  QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD,
  emptyQabOrderPullReport,
  pullQabOrders,
  qabOrderPullErrorCode,
} from "@/lib/qab/orderPoll";
import type { IQabOrderPullReport } from "@/lib/qab/orderPoll";
import { readQabOrderCursor } from "@/lib/qab/qabOrderWrite";
import { withQabOrderPollLock } from "@/lib/qab/orderPollLock";
import { postQabCatalogBatch } from "@/lib/qab/qabCatalogClient";
import { resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import { learnQabAssignedSlugs } from "@/lib/qab/slugLearn";
import type {
  IQabOrderPollBusinessReport,
  IQabOrderPollPhaseReport,
  IQabSyncRunReport,
} from "@/schemas/qabSync";

function emptyOrderPollPhaseReport(): IQabOrderPollPhaseReport {
  return {
    attempted: 0,
    acquired: 0,
    skippedLocked: 0,
    skippedDeadline: 0,
    failed: 0,
    received: 0,
    pulled: 0,
    rejected: 0,
    businesses: [],
  };
}

/**
 * One business's entry of the phase report. Nothing of the pull's own report
 * that could carry an `Order.code`, a token or an error text has a field here:
 * ids and counts only.
 */
function orderPollBusinessReport(
  negocioId: string,
  lock: IQabOrderPollBusinessReport["lock"],
  pull: IQabOrderPullReport,
): IQabOrderPollBusinessReport {
  return {
    negocioId,
    lock,
    outcome: pull.outcome,
    pages: pull.pages,
    received: pull.received,
    pulled: pull.pulled,
    duplicates: pull.duplicates,
    rejected: pull.rejected,
    inconsistentTotals: pull.inconsistentTotals,
    cursorJumps: pull.cursorJumps,
    moreAvailable: pull.moreAvailable,
  };
}

/** Orchestrates one run: drain (push) first, order poll (pull) second. */
export async function runQabSyncTiendaCron(): Promise<IQabSyncRunReport> {
  const startedAt = new Date();
  const startedAtMs = startedAt.getTime();

  // Throws QabConfigError when the variable is present but malformed; the route
  // turns that into a 500. Absent means "not wired yet", not an error (ADR 0014).
  const baseUrl = resolveQabBaseUrl();
  if (baseUrl === null) {
    return {
      startedAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAtMs,
      skipped: QAB_SYNC_SKIPPED_NO_BASE_URL,
      outbox: emptyQabOutboxDrainReport(),
      slugLearn: emptyQabSlugLearnPhaseReport(),
      availability: emptyQabAvailabilityPhaseReport(),
      poll: emptyOrderPollPhaseReport(),
    };
  }

  const outbox = await drainQabOutbox({
    post: ({ token, batch }) => postQabCatalogBatch({ baseUrl, token, batch }),
  });

  // `where` over an omitted field works normally: it filters by the token
  // without ever returning it (ADR 0013). F-003 added `tiendaOnlineHabilitada`
  // to this same `where`: a business with the switch off stays out of the run
  // even when it has a token (acceptance criterion 3, ADR 0021). The push phase
  // filters by the same switch, inside `claimOutboxBatch`.
  const eligible = await prisma.negocio.findMany({
    where: { qabToken: { not: null }, tiendaOnlineHabilitada: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  // The learning phase (F-020, ADR 0036): between the drain and the pull, and
  // OUTSIDE any transaction. No outcome of its side read needs a `try/catch`
  // here — each one is an entry of its report. A database failure does take the
  // run down, like the drain's: see `learnQabAssignedSlugs`.
  const slugLearn = await learnQabAssignedSlugs({
    baseUrl,
    negocioIds: eligible.map((row) => row.id),
    appliedStoreEvents: outbox.appliedStoreEvents,
    deadlineAt: Math.min(
      Date.now() + QAB_SLUG_LEARN_DEADLINE_MS,
      startedAtMs + QAB_SYNC_RUN_DEADLINE_MS,
    ),
  });

  // The availability phase (F-007, ADR 0049): BEHIND the drain, so the PRODUCT
  // event of a product published this run is delivered before its availability
  // goes out, and AHEAD of the pull, which takes an advisory lock per business
  // and can hold a long transaction for each one. It reuses `eligible` — the
  // selection is never recomputed, and that is what keeps a business with no
  // token or with the online store switched off out of the phase entirely.
  const availability = await syncQabAvailability({
    negocioIds: eligible.map((row) => row.id),
    post: ({ token, batch }) => postQabAvailabilityBatch({ baseUrl, token, batch }),
    deadlineAt: Math.min(
      Date.now() + QAB_AVAILABILITY_DEADLINE_MS,
      startedAtMs + QAB_SYNC_RUN_DEADLINE_MS,
    ),
  });

  // The pull phase (F-010, ADR 0054): the LAST one, behind `availability`, and
  // no longer the only phase of the run without a time budget. It reuses the
  // same `eligible`, which is never recomputed here either.
  const poll: IQabOrderPollPhaseReport = {
    attempted: eligible.length,
    acquired: 0,
    skippedLocked: 0,
    skippedDeadline: 0,
    failed: 0,
    received: 0,
    pulled: 0,
    rejected: 0,
    businesses: [],
  };

  const pollDeadlineAt = Math.min(
    Date.now() + QAB_ORDER_POLL_PHASE_DEADLINE_MS,
    startedAtMs + QAB_SYNC_RUN_DEADLINE_MS,
  );

  for (const { id } of eligible) {
    if (Date.now() + QAB_HTTP_TIMEOUT_MS > pollDeadlineAt) {
      // Out of budget: the advisory lock is NOT taken, and the business is picked
      // up by the next run. `not_attempted` is not `skipped_locked`.
      poll.skippedDeadline += 1;
      poll.businesses.push(
        orderPollBusinessReport(id, "not_attempted", emptyQabOrderPullReport("skipped_deadline")),
      );
      continue;
    }

    try {
      const slot = await withQabOrderPollLock(id, async (tx) => {
        // Read inside the locked transaction, through the one function of the
        // repository allowed to read the token (ADR 0013). It never leaves this
        // callback and never reaches the report.
        const token = (await loadQabTokens(tx, [id])).get(id);
        if (!token) return emptyQabOrderPullReport("skipped_no_token");

        // The ONLY `Negocio` read this feature adds, with its own literal query.
        const cursor = await readQabOrderCursor({ tx, negocioId: id });
        return pullQabOrders({
          tx,
          negocioId: id,
          token,
          baseUrl,
          cursor,
          deadlineAt: Math.min(Date.now() + QAB_ORDER_PULL_BUDGET_MS, pollDeadlineAt),
        });
      });

      if (slot.acquired) {
        poll.acquired += 1;
        poll.received += slot.value.received;
        poll.pulled += slot.value.pulled;
        poll.rejected += slot.value.rejected;
        poll.businesses.push(orderPollBusinessReport(id, "acquired", slot.value));
      } else {
        poll.skippedLocked += 1;
        console.log(
          `${QAB_ORDER_POLL_SKIPPED_LOG} negocioId=${id} reason=${QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD}`,
        );
        poll.businesses.push(
          orderPollBusinessReport(id, "skipped_locked", emptyQabOrderPullReport("skipped_locked")),
        );
      }
    } catch (error) {
      // The HTTP path cannot get here — `fetchQabOrdersPage` never rejects — but
      // the DATABASE path can, and `pullQabOrders` cannot catch it: by then the
      // Postgres transaction is already aborted. A P2028 (transaction timeout or
      // maxWait) and a P2002 from `create` both surface HERE, and without this
      // catch they would leave every later business of the loop unprocessed,
      // which is exactly what criterion 12 forbids.
      //
      // `lock: "unknown"`, never "acquired": from outside the slot there is no
      // way to know whether pg_try_advisory_xact_lock ever ran. And only the
      // code is logged — never `error.message`, `String(error)` or `error.meta`,
      // which on a P2002 names fields and sometimes values.
      poll.failed += 1;
      poll.businesses.push(
        orderPollBusinessReport(id, "unknown", emptyQabOrderPullReport("error")),
      );
      console.error(`${QAB_ORDER_PULL_FAILED_LOG} negocioId=${id} code=${qabOrderPullErrorCode(error)}`);
      continue;
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAtMs,
    skipped: null,
    outbox,
    slugLearn,
    availability,
    poll,
  };
}
