import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_RECONCILIATION_LOG,
  QAB_RECONCILIATION_RUN_DEADLINE_MS,
  QAB_SYNC_SKIPPED_NO_BASE_URL,
} from "@/constants/qab";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import { loadQabTokens } from "@/lib/qab/outboxDrain";
import { resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import { fetchQabReconciliation } from "@/lib/qab/qabReconciliationClient";
import { computeQabCatalogHash } from "@/lib/qab/qabReconciliationHash";
import {
  compareQabCatalogHashes,
  qabStoreOutcomeReachedQab,
  selectQabReconciliationTargets,
} from "@/lib/qab/qabReconciliationPlan";
import {
  clearDispPublicadaForStore,
  ensureQabReconciliationRows,
  markQabReconciliationAttempt,
  readQabMirrorRows,
  readQabReconciliationCandidates,
} from "@/lib/qab/qabReconciliationQuery";
import { NotificationService } from "@/services/notificationService";
import type {
  IQabAlertSyncReport,
  IQabReconciliationRunReport,
  IQabReconciliationStoreReport,
} from "@/schemas/qabReconciliation";

const EPOCH_ISO = new Date(0).toISOString();
const SLOT_FAILED_CODE = "SLOT_FAILED";

function emptyAlertReport(): IQabAlertSyncReport {
  return { businesses: 0, stalled: 0, diverged: 0, created: 0, updated: 0, deleted: 0 };
}

/** PURE. A report with every counter at zero and `skipped: null`. */
export function emptyQabReconciliationReport(): IQabReconciliationRunReport {
  return {
    startedAt: EPOCH_ISO,
    durationMs: 0,
    skipped: null,
    businesses: 0,
    candidates: 0,
    attempted: 0,
    matched: 0,
    diverged: 0,
    unknownStores: 0,
    errors: 0,
    tooLarge: 0,
    skippedDeadline: 0,
    clearedRows: 0,
    forcedMissing: 0,
    stores: [],
    alerts: emptyAlertReport(),
  };
}

/**
 * Orchestrates one reconciliation run. Invoked by Vercel every ten minutes; see
 * `vercel.json`.
 *
 * Order, and it matters:
 *  1. `resolveQabBaseUrl()`. `null` means "not wired yet", not an error: returns
 *     the report with `skipped: QAB_SYNC_SKIPPED_NO_BASE_URL` and does not touch
 *     the database, exactly as `runQabSyncTiendaCron` does (ADR 0014). A
 *     `QabConfigError` propagates and the route turns it into a 500.
 *  2. `eligible`: the SAME selection `runQabSyncTiendaCron` computes, written the
 *     same way and never widened here.
 *  3. `readQabReconciliationCandidates` + `ensureQabReconciliationRows`.
 *  4. Targets: `selectQabReconciliationTargets(...)`, or — when `tiendaIds` is
 *     given — the candidates whose `tiendaId` is in that list, with the per-run
 *     caps not applied to them. `forcedMissing` counts the requested ids that
 *     matched no candidate; a foreign or nonexistent id simply is not a
 *     candidate, so it is refused by construction and never by a check.
 *  5. Per target, each inside its own `try/catch` (criterion 4): budget check
 *     first — `Date.now() + QAB_HTTP_TIMEOUT_MS > deadlineAt` reports
 *     `skipped_deadline` and writes NOTHING, not even `ultimaComparacionAt` —
 *     then read, hash, fetch, compare, maybe recover, and record.
 *  6. `NotificationService.checkQabSyncAlerts()`, unscoped, once.
 *
 * `deadlineAt` is `startedAt + QAB_RECONCILIATION_RUN_DEADLINE_MS`.
 *
 * The token is read through `loadQabTokens(qabPrisma, negocioIds)`
 * (`src/lib/qab/outboxDrain.ts`), the one function of the repository allowed to
 * read several tokens at once (ADR 0013). No new `select` is added, and the
 * token never reaches the report or a log.
 *
 * Per-store decision, and this is the whole of it:
 *   too many local rows              -> "too_large",      no write, no recovery
 *   { kind: "error", UNKNOWN_STORE } -> "unknown_store",  no write, no recovery
 *   { kind: "error", any other }     -> "upstream_error", no write, no recovery
 *   verdict "match"                  -> "match",          divergence flag cleared
 *   verdict "diverged"               -> "diverged",        `clearDispPublicadaForStore`
 *   a throw from the slot            -> "upstream_error", counted, loop continues
 */
export async function runQabReconciliationCron(args?: {
  /** Force these stores, bypassing the per-run caps. For verification. */
  tiendaIds?: string[];
  /** Injected clock. Defaults to `new Date()`. */
  now?: Date;
}): Promise<IQabReconciliationRunReport> {
  const startedAt = args?.now ?? new Date();
  const startedAtMs = startedAt.getTime();
  // Measured against the wall clock and not against `startedAtMs`: an injected
  // `now` would otherwise make `durationMs` negative, which its own schema
  // rejects. The DEADLINE is the injected clock's, exactly as the contract says.
  const wallStartMs = Date.now();
  const report = emptyQabReconciliationReport();
  report.startedAt = startedAt.toISOString();

  // Throws QabConfigError when the variable is present but malformed; the route
  // turns that into a 500. Absent means "not wired yet", not an error (ADR 0014).
  const baseUrl = resolveQabBaseUrl();
  if (baseUrl === null) {
    report.skipped = QAB_SYNC_SKIPPED_NO_BASE_URL;
    report.durationMs = Date.now() - wallStartMs;
    return report;
  }

  const eligible = await qabPrisma.negocio.findMany({
    where: { qabToken: { not: null }, tiendaOnlineHabilitada: true },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  report.businesses = eligible.length;

  const negocioIds = eligible.map((row) => row.id);
  const candidates = await readQabReconciliationCandidates({ negocioIds });
  report.candidates = candidates.length;

  await ensureQabReconciliationRows({
    targets: candidates.map((candidate) => ({
      negocioId: candidate.negocioId,
      tiendaId: candidate.tiendaId,
    })),
  });

  const forced = args?.tiendaIds;
  let targets = candidates;
  if (forced !== undefined) {
    const wanted = new Set(forced);
    targets = candidates.filter((candidate) => wanted.has(candidate.tiendaId));
    const found = new Set(targets.map((candidate) => candidate.tiendaId));
    report.forcedMissing = [...wanted].filter((tiendaId) => !found.has(tiendaId)).length;
  } else {
    targets = selectQabReconciliationTargets({ candidates });
  }

  const tokens = await loadQabTokens(qabPrisma, negocioIds);
  const deadlineAt = startedAtMs + QAB_RECONCILIATION_RUN_DEADLINE_MS;

  for (const target of targets) {
    const { negocioId, tiendaId } = target;

    try {
      if (Date.now() + QAB_HTTP_TIMEOUT_MS > deadlineAt) {
        // Out of budget: nothing is written, not even `ultimaComparacionAt`, so
        // this store stays the stalest one and the next run takes it.
        pushStore(report, {
          negocioId,
          tiendaId,
          outcome: "skipped_deadline",
          localProducts: null,
          remoteProducts: null,
          hashMatch: null,
          clearedRows: 0,
          upstreamCode: null,
        });
        continue;
      }

      const token = tokens.get(negocioId);
      if (!token) {
        // `eligible` already required a non-null token, so this is the empty
        // string. There is no comparable answer and no request was made.
        await markQabReconciliationAttempt({
          negocioId,
          tiendaId,
          at: new Date(),
          reachedQab: false,
          diverged: null,
        });
        pushStore(report, {
          negocioId,
          tiendaId,
          outcome: "upstream_error",
          localProducts: null,
          remoteProducts: null,
          hashMatch: null,
          clearedRows: 0,
          upstreamCode: null,
        });
        continue;
      }

      const mirror = await readQabMirrorRows({ tiendaId });
      if (mirror.tooLarge) {
        // Hashing a truncated selection produces a FALSE divergence, and a false
        // divergence wipes `dispPublicada` of the whole store. No request either.
        await markQabReconciliationAttempt({
          negocioId,
          tiendaId,
          at: new Date(),
          reachedQab: false,
          diverged: null,
        });
        pushStore(report, {
          negocioId,
          tiendaId,
          outcome: "too_large",
          localProducts: null,
          remoteProducts: null,
          hashMatch: null,
          clearedRows: 0,
          upstreamCode: null,
        });
        continue;
      }

      const local = computeQabCatalogHash(mirror.rows);
      const outcome = await fetchQabReconciliation({ baseUrl, token, storeId: tiendaId });

      if (outcome.kind === "error") {
        const storeOutcome =
          outcome.code === "UNKNOWN_STORE" ? "unknown_store" : "upstream_error";
        await markQabReconciliationAttempt({
          negocioId,
          tiendaId,
          at: new Date(),
          reachedQab: qabStoreOutcomeReachedQab(storeOutcome),
          diverged: null,
        });
        pushStore(report, {
          negocioId,
          tiendaId,
          outcome: storeOutcome,
          localProducts: local.products,
          remoteProducts: null,
          hashMatch: null,
          clearedRows: 0,
          upstreamCode: outcome.code,
        });
        continue;
      }

      const verdict = compareQabCatalogHashes(local, outcome.response);
      const diverged = verdict === "diverged";
      const clearedRows = diverged
        ? await clearDispPublicadaForStore({ negocioId, tiendaId })
        : 0;

      await markQabReconciliationAttempt({
        negocioId,
        tiendaId,
        at: new Date(),
        reachedQab: true,
        diverged,
      });

      pushStore(report, {
        negocioId,
        tiendaId,
        outcome: verdict,
        localProducts: local.products,
        remoteProducts: outcome.response.products,
        hashMatch: verdict === "match",
        clearedRows,
        upstreamCode: null,
      });
    } catch {
      // The HTTP path cannot get here — `fetchQabReconciliation` never rejects —
      // but the DATABASE path can. Without this catch one store's failure would
      // leave every later store of the loop unprocessed, which is exactly what
      // criterion 4 forbids. Only a fixed code is logged: a runtime error
      // message quotes the value that broke it (E-031).
      pushStore(report, {
        negocioId,
        tiendaId,
        outcome: "upstream_error",
        localProducts: null,
        remoteProducts: null,
        hashMatch: null,
        clearedRows: 0,
        upstreamCode: null,
      });
      console.error(
        `${QAB_RECONCILIATION_LOG}.failed negocioId=${negocioId} tiendaId=${tiendaId} code=${SLOT_FAILED_CODE}`,
      );
      continue;
    }
  }

  report.alerts = await NotificationService.checkQabSyncAlerts();
  report.durationMs = Date.now() - wallStartMs;
  return report;
}

/** Appends one store's entry and moves the run's counters with it. */
function pushStore(
  report: IQabReconciliationRunReport,
  store: IQabReconciliationStoreReport,
): void {
  report.stores.push(store);
  report.clearedRows += store.clearedRows;

  if (store.outcome === "skipped_deadline") {
    report.skippedDeadline += 1;
    return;
  }

  report.attempted += 1;
  if (store.outcome === "match") report.matched += 1;
  else if (store.outcome === "diverged") report.diverged += 1;
  else if (store.outcome === "unknown_store") report.unknownStores += 1;
  else if (store.outcome === "too_large") report.tooLarge += 1;
  else report.errors += 1;
}
