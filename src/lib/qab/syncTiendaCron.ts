import { QAB_SYNC_SKIPPED_NO_BASE_URL } from "@/constants/qab";
import { prisma } from "@/lib/prisma";
import { emptyQabOutboxDrainReport } from "@/lib/qab/outboxAck";
import { drainQabOutbox, loadQabTokens } from "@/lib/qab/outboxDrain";
import {
  QAB_ORDER_POLL_SKIPPED_LOG,
  QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD,
  pullQabOrders,
} from "@/lib/qab/orderPoll";
import { withQabOrderPollLock } from "@/lib/qab/orderPollLock";
import { postQabCatalogBatch } from "@/lib/qab/qabCatalogClient";
import { resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import type { IQabOrderPollPhaseReport, IQabSyncRunReport } from "@/schemas/qabSync";

function emptyOrderPollPhaseReport(): IQabOrderPollPhaseReport {
  return { attempted: 0, acquired: 0, skippedLocked: 0, businesses: [] };
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

  const poll: IQabOrderPollPhaseReport = {
    attempted: eligible.length,
    acquired: 0,
    skippedLocked: 0,
    businesses: [],
  };

  for (const { id } of eligible) {
    const slot = await withQabOrderPollLock(id, async (tx) => {
      // Read inside the locked transaction, through the one function of the
      // repository allowed to read the token (ADR 0013). It never leaves this
      // callback and never reaches the report.
      const token = (await loadQabTokens(tx, [id])).get(id);
      if (!token) return { pulled: 0, implemented: false };
      return pullQabOrders({ tx, negocioId: id, token, baseUrl });
    });

    if (slot.acquired) {
      poll.acquired += 1;
      poll.businesses.push({ negocioId: id, lock: "acquired", pulled: slot.value.pulled });
    } else {
      poll.skippedLocked += 1;
      console.log(
        `${QAB_ORDER_POLL_SKIPPED_LOG} negocioId=${id} reason=${QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD}`,
      );
      poll.businesses.push({ negocioId: id, lock: "skipped_locked", pulled: 0 });
    }
  }

  return {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAtMs,
    skipped: null,
    outbox,
    poll,
  };
}
