import {
  QAB_SLUG_LEARN_CANDIDATE_MAX_ROWS,
  QAB_SLUG_LEARN_DEADLINE_MS,
  QAB_SLUG_LEARN_MAX_PER_RUN,
} from "@/constants/qab";
import {
  QabTenantMismatchError,
  emptyQabSlugLearnPhaseReport,
} from "@/lib/qab/outboxAck";
import { loadQabTokens } from "@/lib/qab/outboxDrain";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import { logQabSlugLearnOutcome } from "@/lib/qab/qabOutboxLog";
import { fetchQabSlugAvailability } from "@/lib/qab/qabSlugClient";
import type { IQabSlugOutcome, IQabSlugQuery } from "@/lib/qab/qabSlugClient";
import { qabAppliedPublishWhere } from "@/lib/qab/qabStoreOutboxFilters";
import {
  assertQabSlugLearningTenant,
  decideQabSlugLearning,
  groupQabSlugLearningTargetsByNegocio,
  orderQabSlugLearningTargets,
  qabSlugLearnQuery,
} from "@/lib/qab/slugLearnPlan";
import { TipoLocal } from "@/schemas/tienda";
import type {
  IQabAppliedStorePublish,
  IQabSlugLearningTarget,
  IQabSlugLearnPhaseReport,
  IQabSlugLearnResult,
} from "@/schemas/qabSync";

/** Separator of the (negocioId, tiendaId) key. A character no id can contain. */
const PAIR_KEY_SEPARATOR = " ";

function pairKey(negocioId: string, tiendaId: string): string {
  return `${negocioId}${PAIR_KEY_SEPARATOR}${tiendaId}`;
}

/**
 * The eligible set of ADR 0036b, as ONE pair of queries — never one per local.
 *
 *   1. `Tienda` candidates: negocioId IN, `slugQab: null`, `tipo: "TIENDA"`,
 *      ordered by `id`, `take: QAB_SLUG_LEARN_CANDIDATE_MAX_ROWS`.
 *   2. one `groupBy({ by: ["negocioId", "entidadId"], where: qabAppliedPublishWhere(...) })`
 *      over those candidates.
 *
 * The pairing comes back from the `groupBy` itself as (negocioId, entidadId), so
 * a candidate is kept only when ITS OWN pair is in the result. Nothing is ever
 * matched by `tiendaId` alone.
 *
 * A `Tienda.findMany({ where: { slugQab: null } })` without `negocioId` is
 * forbidden: `Tienda` has no `@@unique([id, negocioId])`.
 */
export async function readQabSlugLearningTargets(
  negocioIds: string[],
): Promise<IQabSlugLearningTarget[]> {
  if (negocioIds.length === 0) return [];

  const candidates = await qabPrisma.tienda.findMany({
    where: { negocioId: { in: negocioIds }, slugQab: null, tipo: TipoLocal.TIENDA },
    select: { id: true, negocioId: true, slug: true, nombre: true },
    orderBy: { id: "asc" },
    take: QAB_SLUG_LEARN_CANDIDATE_MAX_ROWS,
  });
  if (candidates.length === 0) return [];

  const applied = await qabPrisma.outboxEvento.groupBy({
    by: ["negocioId", "entidadId"],
    where: qabAppliedPublishWhere({
      negocioIds,
      tiendaIds: candidates.map((row) => row.id),
    }),
  });

  const appliedPairs = new Set(
    applied.map((row) => pairKey(row.negocioId, row.entidadId)),
  );

  return candidates
    .filter((row) => appliedPairs.has(pairKey(row.negocioId, row.id)))
    .map((row) => ({
      negocioId: row.negocioId,
      tiendaId: row.id,
      slug: row.slug,
      nombre: row.nombre,
    }));
}

/**
 * Writes the learned slug. `true` when it landed, `false` when it did not — and
 * `false` is NEVER an exception: `count !== 1` is a silent failure of this run
 * (the column was learned by a concurrent run, or the local is gone), and the
 * next run asks again.
 *
 * The `where` carries the THREE conditions: `id`, `negocioId` — the tenant
 * filter goes in the SQL, not in a later `if` — and `slugQab: null`, which makes
 * the write idempotent and never overwrites a value already learned.
 */
export async function writeLearnedQabSlug(args: {
  negocioId: string;
  tiendaId: string;
  slugQab: string;
}): Promise<boolean> {
  const { count } = await qabPrisma.tienda.updateMany({
    where: { id: args.tiendaId, negocioId: args.negocioId, slugQab: null },
    data: { slugQab: args.slugQab },
  });
  return count === 1;
}

export interface IQabSlugLearnArgs {
  baseUrl: string;
  /** The businesses of this run: token present and `tiendaOnlineHabilitada`. */
  negocioIds: string[];
  /** From the drain report. ONLY reorders (ADR 0036b). Defaults to []. */
  appliedStoreEvents?: IQabAppliedStorePublish[];
  /** Injected so the phase can be exercised without a network. */
  fetchSlug?: (args: {
    baseUrl: string;
    token: string;
    query: IQabSlugQuery;
  }) => Promise<IQabSlugOutcome>;
  /** Absolute ms deadline of the phase. Defaults to Date.now() + QAB_SLUG_LEARN_DEADLINE_MS. */
  deadlineAt?: number;
}

/**
 * The learning phase.
 *
 * **No outcome of the side read can throw.** Transport failures, a status the
 * contract does not document, a body that does not parse, a `reason` other than
 * `own`, a `resolvedSlug` that fails `qabSlugSchema`, a write that did not land,
 * a tenant mismatch, a business with no token and a target left out of the
 * budget all come back as an entry of `results[]` with its closed code
 * (`upstream_error`, `not_own`, `invalid_slug`, `not_written`,
 * `tenant_mismatch`, `skipped_no_token`, `skipped_deadline`). That is what
 * acceptance criterion 5 asks for, and it needs no `try/catch` at the call site:
 * nothing of it re-queues the STORE event, raises its `intentos` or blocks the
 * screen.
 *
 * **A DATABASE failure DOES propagate**, exactly as it does in the drain: the
 * two queries of the eligible set and the `updateMany` of the write are not
 * wrapped, so a rejected connection takes the run down and the cron route turns
 * it into a 500. Deliberate, and stated here so the promise matches the code: a
 * swallowed database error would hide a broken pool behind a report full of
 * zeroes. Nothing is lost when it happens — the phase persists no retry state,
 * so the next run asks the same question again (ADR 0036c).
 *
 * It runs OUTSIDE any transaction, on the dedicated `qabPrisma` pool, with short
 * queries. It cannot contaminate the drain's acknowledgement because it has no
 * access to it: this module never writes `OutboxEvento`, never names
 * `Negocio.qabUltimoPedidoVisto` or `PedidoEntrante`, and the only HTTP route it
 * ever issues is QAB_SLUG_AVAILABILITY_PATH (criteria 4 and 5).
 */
export async function learnQabAssignedSlugs(
  args: IQabSlugLearnArgs,
): Promise<IQabSlugLearnPhaseReport> {
  const report = emptyQabSlugLearnPhaseReport();
  if (args.negocioIds.length === 0) return report;

  const fetchSlug = args.fetchSlug ?? fetchQabSlugAvailability;
  const deadlineAt = args.deadlineAt ?? Date.now() + QAB_SLUG_LEARN_DEADLINE_MS;

  const targets = await readQabSlugLearningTargets(args.negocioIds);
  report.targets = targets.length;
  if (targets.length === 0) return report;

  const ordered = orderQabSlugLearningTargets(targets, args.appliedStoreEvents ?? []);
  const capped = ordered.slice(0, QAB_SLUG_LEARN_MAX_PER_RUN);
  // A target left out of the cap loses NOTHING: the next run finds it again
  // through the same query (ADR 0036c).
  const overflow = ordered.slice(QAB_SLUG_LEARN_MAX_PER_RUN);

  const results: IQabSlugLearnResult[] = [];
  const groups = groupQabSlugLearningTargetsByNegocio(capped);
  // By key, never by array index, and through the one function of the repository
  // allowed to read several tokens at once (ADR 0013). No new `select` here.
  const tokens = await loadQabTokens(
    qabPrisma,
    groups.map((group) => group.negocioId),
  );

  for (const group of groups) {
    const token = tokens.get(group.negocioId);

    if (!token) {
      for (const target of group.targets) {
        results.push({
          negocioId: group.negocioId,
          tiendaId: target.tiendaId,
          outcome: "skipped_no_token",
        });
      }
      continue;
    }

    for (const target of group.targets) {
      if (Date.now() >= deadlineAt) {
        results.push({
          negocioId: group.negocioId,
          tiendaId: target.tiendaId,
          outcome: "skipped_deadline",
        });
        continue;
      }

      try {
        assertQabSlugLearningTenant(group.negocioId, target);
      } catch (error) {
        if (!(error instanceof QabTenantMismatchError)) throw error;
        results.push({
          negocioId: group.negocioId,
          tiendaId: target.tiendaId,
          outcome: "tenant_mismatch",
        });
        continue;
      }

      const outcome = await fetchSlug({
        baseUrl: args.baseUrl,
        token,
        query: qabSlugLearnQuery(target),
      });
      report.attempted += 1;

      const decision = decideQabSlugLearning(outcome);
      if (decision.kind !== "write") {
        results.push({
          negocioId: group.negocioId,
          tiendaId: target.tiendaId,
          outcome: decision.kind,
        });
        continue;
      }

      const written = await writeLearnedQabSlug({
        negocioId: group.negocioId,
        tiendaId: target.tiendaId,
        slugQab: decision.slugQab,
      });
      if (written) report.learned += 1;
      results.push({
        negocioId: group.negocioId,
        tiendaId: target.tiendaId,
        outcome: written ? "learned" : "not_written",
      });
    }
  }

  for (const target of overflow) {
    results.push({
      negocioId: target.negocioId,
      tiendaId: target.tiendaId,
      outcome: "skipped_deadline",
    });
  }

  for (const result of results) logQabSlugLearnOutcome(result);
  report.results = results;
  return report;
}
