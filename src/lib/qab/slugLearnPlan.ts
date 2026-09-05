import {
  QAB_SLUG_LEARNED_REASON,
  QAB_SLUG_QUERY_MAX_LENGTH,
} from "@/constants/qab";
import { QabTenantMismatchError } from "@/lib/qab/outboxAck";
import type {
  IQabSlugOutcome,
  IQabSlugQuery,
  IQabSlugUpstreamCode,
} from "@/lib/qab/qabSlugClient";
import { qabSlugSchema } from "@/schemas/qabStore";
import type {
  IQabAppliedStorePublish,
  IQabSlugLearningTarget,
} from "@/schemas/qabSync";

export type IQabSlugLearnDecision =
  | { kind: "upstream_error"; code: IQabSlugUpstreamCode }
  | { kind: "not_own" }
  | { kind: "invalid_slug" }
  | { kind: "write"; slugQab: string };

/**
 * PURE. NEVER throws. Given the outcome of ONE `fetchQabSlugAvailability` call,
 * says whether `Tienda.slugQab` gets written and with what.
 *
 * The order of the guards is part of the decision (ADR 0037) and is NOT an
 * implementation detail: the `reason` guard goes BEFORE any read of
 * `resolvedSlug`, so no future reordering can skip it.
 *
 * The written value is NEVER derived from anything else: not `Tienda.slug`, not
 * `forecast.candidate`, not `forecast.url`, and not a pre-publish forecast.
 */
export function decideQabSlugLearning(
  outcome: IQabSlugOutcome,
): IQabSlugLearnDecision {
  // 1. Transport, status or body failure: nothing of the body is read at all.
  if (outcome.kind !== "ok") {
    return { kind: "upstream_error", code: outcome.code };
  }

  // 2. Only `own` proves the value belongs to this storeId. BEFORE reading
  //    `resolvedSlug`, so a perfectly valid slug of another brand cannot land.
  if (outcome.forecast.reason !== QAB_SLUG_LEARNED_REASON) {
    return { kind: "not_own" };
  }

  // 3. External input, validated before it is persisted and before it becomes an
  //    href. The received value is deliberately NOT logged.
  const parsed = qabSlugSchema.safeParse(outcome.forecast.resolvedSlug);
  if (!parsed.success) {
    return { kind: "invalid_slug" };
  }

  return { kind: "write", slugQab: parsed.data };
}

/**
 * PURE. The § ⑥ query for one target. `storeId` is ALWAYS sent — it is the whole
 * point of this read (criterion 1's stale-forecast trap). `slug` when the
 * merchant asked for one, `name` otherwise: § ⑥ answers 400 MISSING_QUERY
 * without either. `name` is capped at QAB_SLUG_QUERY_MAX_LENGTH so no unbounded
 * string leaves cuadrecaja.
 */
export function qabSlugLearnQuery(target: IQabSlugLearningTarget): IQabSlugQuery {
  if (target.slug !== null) {
    return { slug: target.slug, storeId: target.tiendaId };
  }
  return {
    name: target.nombre.slice(0, QAB_SLUG_QUERY_MAX_LENGTH),
    storeId: target.tiendaId,
  };
}

/**
 * PURE. Same pattern as `groupOutboxEventsByNegocio`: partitions by business so
 * the token can never be resolved by array index. Groups ordered by `negocioId`
 * ascending; targets inside each group keep the order they came in.
 */
export function groupQabSlugLearningTargetsByNegocio(
  targets: IQabSlugLearningTarget[],
): Array<{ negocioId: string; targets: IQabSlugLearningTarget[] }> {
  const groups = new Map<string, IQabSlugLearningTarget[]>();
  for (const target of targets) {
    const group = groups.get(target.negocioId);
    if (group) group.push(target);
    else groups.set(target.negocioId, [target]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([negocioId, groupTargets]) => ({ negocioId, targets: groupTargets }));
}

/** Separator of the pair key. A character no id can contain. */
const PAIR_KEY_SEPARATOR = " ";

/** The (negocioId, tiendaId) pair as one comparable key. */
function pairKey(negocioId: string, tiendaId: string): string {
  return `${negocioId}${PAIR_KEY_SEPARATOR}${tiendaId}`;
}

/**
 * PURE. Puts the targets whose (negocioId, tiendaId) appears in
 * `appliedStoreEvents` FIRST, keeping the relative order of both halves.
 *
 * It ONLY reorders (ADR 0036b): an entry of `appliedStoreEvents` that is not in
 * `targets` is IGNORED, and the returned array is a permutation of `targets` —
 * same length, same elements. Reordering never widens the eligible set.
 *
 * The pairing is by the FULL pair, never by `tiendaId` alone.
 */
export function orderQabSlugLearningTargets(
  targets: IQabSlugLearningTarget[],
  appliedStoreEvents: IQabAppliedStorePublish[],
): IQabSlugLearningTarget[] {
  const applied = new Set(
    appliedStoreEvents.map((entry) => pairKey(entry.negocioId, entry.tiendaId)),
  );

  const first: IQabSlugLearningTarget[] = [];
  const rest: IQabSlugLearningTarget[] = [];
  for (const target of targets) {
    if (applied.has(pairKey(target.negocioId, target.tiendaId))) first.push(target);
    else rest.push(target);
  }

  return [...first, ...rest];
}

/**
 * Throws `QabTenantMismatchError` when `target.negocioId !== negocioId`. The
 * tenant boundary is an invariant of the phase, not something the caller has to
 * remember — same discipline as `toQabCatalogBatch`.
 */
export function assertQabSlugLearningTenant(
  negocioId: string,
  target: IQabSlugLearningTarget,
): void {
  if (target.negocioId !== negocioId) {
    throw new QabTenantMismatchError(
      `Slug learning target ${target.tiendaId} belongs to another business than the group it was put in`,
    );
  }
}
