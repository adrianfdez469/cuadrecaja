import {
  QAB_AVAILABILITY_DEADLINE_MS,
  QAB_AVAILABILITY_LOG,
  QAB_AVAILABILITY_MAX_ROWS_PER_RUN,
} from "@/constants/qab";
import { loadQabTokens } from "@/lib/qab/outboxDrain";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import {
  chunkDivergentRows,
  emptyQabAvailabilityPhaseReport,
  groupDivergentRowsByNegocio,
  planAvailabilityWrites,
  toQabAvailabilityBatch,
} from "@/lib/qab/qabAvailabilityPlan";
import {
  readDivergentAvailabilityRows,
  readProductoTiendaIdsWithPendingProductEvent,
  writeDispPublicada,
} from "@/lib/qab/qabAvailabilityQuery";
import type {
  IQabAvailabilityBatch,
  IQabAvailabilityBusinessReport,
  IQabAvailabilityPhaseReport,
} from "@/schemas/qabAvailability";
import type { IQabAvailabilityPostOutcome } from "@/lib/qab/qabAvailabilityClient";

export interface IQabAvailabilitySyncDeps {
  /** The eligible businesses the cron already computed. Never recomputed here. */
  negocioIds: string[];
  /** Injected so the phase can be exercised without a network. */
  post: (args: {
    negocioId: string;
    token: string;
    batch: IQabAvailabilityBatch;
  }) => Promise<IQabAvailabilityPostOutcome>;
  /** Defaults to `Date.now() + QAB_AVAILABILITY_DEADLINE_MS`, fixed on entry. */
  deadlineAt?: number;
  /** Defaults to QAB_AVAILABILITY_MAX_ROWS_PER_RUN. */
  limit?: number;
}

/**
 * One line per processed business. Ids and counts only: never the sent payload,
 * never the received body, never the token, never the text of an `error`.
 * `qab.availability negocioId=<id> items=<n> requests=<n> confirmed=<n> written=<n> outcome=<outcome>`
 */
function logQabAvailabilityBusiness(report: IQabAvailabilityBusinessReport): void {
  console.info(
    `${QAB_AVAILABILITY_LOG} negocioId=${report.negocioId} items=${report.items} requests=${report.requests} confirmed=${report.confirmed} written=${report.written} outcome=${report.outcome}`,
  );
}

/**
 * One convergence pass over every eligible business.
 *
 * The divergence between the recomputed enum and `dispPublicada` IS the queue:
 * nothing is enqueued, nothing counts attempts and nothing is re-queued by hand.
 * A row that is not read, not sent or not confirmed simply stays divergent and
 * the next run reads it again (ADR 0050).
 *
 * A failing business does not abort the run: `deps.post` reports its failure as
 * a value, the business is marked `error` and its remaining pages are dropped,
 * while the loop moves on to the next business (criterion 11). A DATABASE
 * failure DOES propagate, exactly as it does in the drain and in the slug
 * phase: a swallowed one would hide a broken pool behind a report of zeroes.
 */
export async function syncQabAvailability(
  deps: IQabAvailabilitySyncDeps,
): Promise<IQabAvailabilityPhaseReport> {
  const report = emptyQabAvailabilityPhaseReport();
  const { negocioIds } = deps;
  if (negocioIds.length === 0) return report;

  const deadlineAt = deps.deadlineAt ?? Date.now() + QAB_AVAILABILITY_DEADLINE_MS;
  const limit = deps.limit ?? QAB_AVAILABILITY_MAX_ROWS_PER_RUN;

  const rows = await readDivergentAvailabilityRows({ negocioIds, limit });
  if (rows.length === 0) return report;

  report.rows = rows.length;
  report.capped = rows.length === limit;

  // A row whose PRODUCT event is still pending and still retryable does not send
  // its availability yet: the other side would confirm it before its
  // StoreProduct exists, and the row would stop diverging for ever (ADR 0049).
  const pending = await readProductoTiendaIdsWithPendingProductEvent({
    negocioIds,
    productoTiendaIds: rows.map((row) => row.productoTiendaId),
  });
  const sendable = rows.filter((row) => !pending.has(row.productoTiendaId));

  // Through the one function of the repository allowed to read several tokens at
  // once (ADR 0013). No `select` of its own here.
  const tokens = await loadQabTokens(qabPrisma, negocioIds);

  const groups = groupDivergentRowsByNegocio(sendable);
  report.businesses = groups.length;

  for (const group of groups) {
    const token = tokens.get(group.negocioId);

    let outcome: IQabAvailabilityBusinessReport["outcome"] = "ok";
    let requests = 0;
    let confirmed = 0;
    let written = 0;

    if (!token) {
      outcome = "skipped_no_token";
    } else if (Date.now() >= deadlineAt) {
      outcome = "skipped_deadline";
    } else {
      for (const page of chunkDivergentRows(group.rows)) {
        if (Date.now() >= deadlineAt) {
          // Its rows stay divergent; the next run picks them up.
          if (requests === 0) outcome = "skipped_deadline";
          break;
        }

        const batch = toQabAvailabilityBatch(group.negocioId, page);
        const result = await deps.post({ negocioId: group.negocioId, token, batch });
        requests += 1;

        if (result.kind === "error") {
          // This business stops here; the run continues with the next one.
          outcome = "error";
          break;
        }

        const plan = planAvailabilityWrites(page, result);
        confirmed += plan.confirmed;
        written += await writeDispPublicada({ negocioId: group.negocioId, plan });
      }
    }

    const businessReport: IQabAvailabilityBusinessReport = {
      negocioId: group.negocioId,
      items: group.rows.length,
      requests,
      confirmed,
      written,
      outcome,
    };

    report.requests += requests;
    report.confirmed += confirmed;
    report.written += written;
    report.byBusiness.push(businessReport);
    logQabAvailabilityBusiness(businessReport);
  }

  return report;
}
