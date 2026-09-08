import {
  QAB_ALERT_ACTION_URL,
  QAB_ALERT_NOTIFICATION_TTL_DAYS,
  QAB_ALERT_TITLES,
  QAB_RECONCILIATION_MAX_STORES_PER_BUSINESS_PER_RUN,
  QAB_RECONCILIATION_MAX_STORES_PER_RUN,
  QAB_RECONCILIATION_REACHABLE_OUTCOMES,
  QAB_RECONCILIATION_VERDICTS,
  QAB_SYNC_STALE_THRESHOLD_MS,
} from "@/constants/qab";
import type {
  IQabAlertPlan,
  IQabBusinessAlertState,
  IQabCatalogHash,
  IQabReconciliationStoreOutcome,
  IQabReconciliationTarget,
  IQabSyncStalenessRow,
} from "@/schemas/qabReconciliation";

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;
const NOMBRE_SEPARATOR = ", ";
const ALERT_LEVEL = "ALTA";
const ALERT_TYPE = "ALERTA";
const NO_USERS = "";

/** The two verdicts of a comparison. Declared in src/constants/qab.ts. */
export { QAB_RECONCILIATION_VERDICTS };
export type IQabReconciliationVerdict = (typeof QAB_RECONCILIATION_VERDICTS)[number];

/** PURE. Ascending order of two ids, with no collation in the way. */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * PURE. "match" when `products` AND `hash` are both equal; "diverged" otherwise.
 *
 * Comparing `products` too is DELIBERATELY wider than § ⑤, which only speaks of
 * the hash: two equal hashes with different counts means one of the two sides is
 * broken, and the safe reading of "broken" here is "resend everything", which is
 * what a divergence does. It has its own test (§ 9).
 */
export function compareQabCatalogHashes(
  local: IQabCatalogHash,
  remote: IQabCatalogHash,
): IQabReconciliationVerdict {
  const agrees = local.products === remote.products && local.hash === remote.hash;
  return agrees ? "match" : "diverged";
}

/**
 * PURE. The stores one run compares, chosen from the candidates.
 *
 * Sorts a COPY of `candidates` by, in order:
 *   1. `ultimaComparacionAt === null` first (never compared),
 *   2. then `ultimaComparacionAt` ascending (stalest first),
 *   3. then `tiendaId` ascending, as a deterministic tiebreak.
 * Then walks that order taking at most `maxPerBusiness` per `negocioId` until
 * `maxTotal` is reached. Result order is the walk order.
 *
 * Defaults: QAB_RECONCILIATION_MAX_STORES_PER_BUSINESS_PER_RUN and
 * QAB_RECONCILIATION_MAX_STORES_PER_RUN. `candidates: []` returns `[]`.
 */
export function selectQabReconciliationTargets(args: {
  candidates: IQabReconciliationTarget[];
  maxPerBusiness?: number;
  maxTotal?: number;
}): IQabReconciliationTarget[] {
  const maxPerBusiness =
    args.maxPerBusiness ?? QAB_RECONCILIATION_MAX_STORES_PER_BUSINESS_PER_RUN;
  const maxTotal = args.maxTotal ?? QAB_RECONCILIATION_MAX_STORES_PER_RUN;

  const ordered = [...args.candidates].sort((a, b) => {
    const aNever = a.ultimaComparacionAt === null;
    const bNever = b.ultimaComparacionAt === null;
    if (aNever !== bNever) return aNever ? -1 : 1;
    if (!aNever && !bNever) {
      const delta = a.ultimaComparacionAt.getTime() - b.ultimaComparacionAt.getTime();
      if (delta !== 0) return delta;
    }
    return compareIds(a.tiendaId, b.tiendaId);
  });

  const selected: IQabReconciliationTarget[] = [];
  const perBusiness = new Map<string, number>();

  for (const candidate of ordered) {
    if (selected.length >= maxTotal) break;
    const taken = perBusiness.get(candidate.negocioId) ?? 0;
    if (taken >= maxPerBusiness) continue;
    perBusiness.set(candidate.negocioId, taken + 1);
    selected.push(candidate);
  }

  return selected;
}

/**
 * PURE. True for the members of QAB_RECONCILIATION_REACHABLE_OUTCOMES, which is
 * the ONE place the set is written.
 */
export function qabStoreOutcomeReachedQab(
  outcome: IQabReconciliationStoreOutcome,
): boolean {
  return (QAB_RECONCILIATION_REACHABLE_OUTCOMES as readonly string[]).includes(outcome);
}

/**
 * PURE. One entry per distinct `negocioId` present in `rows`, ordered by
 * `negocioId` ascending. A business with NO rows produces NO entry, and
 * therefore no alert: that is how an eligible business with no published store
 * stays out of the staleness alert instead of being flagged for ever.
 *
 * Per business:
 *   `ultimoContactoAt` = max over its rows of `ultimoContactoOkAt ?? createdAt`.
 *      Falling back to `createdAt` is what keeps a business enabled two minutes
 *      ago out of the alert: its row is new, so it is not stale yet.
 *   `stale` = `now.getTime() - ultimoContactoAt.getTime() > thresholdMs`.
 *   `divergedTiendaIds` / `divergedNombres` = the rows whose `hashDivergenteAt`
 *      is not null, ascending by `tiendaId`, and their `nombre` in that SAME
 *      order. Ordered by id and not by name so the copy is stable across runs.
 *
 * `thresholdMs` defaults to QAB_SYNC_STALE_THRESHOLD_MS.
 */
export function aggregateQabBusinessAlertState(args: {
  rows: IQabSyncStalenessRow[];
  now: Date;
  thresholdMs?: number;
}): IQabBusinessAlertState[] {
  const thresholdMs = args.thresholdMs ?? QAB_SYNC_STALE_THRESHOLD_MS;
  const nowMs = args.now.getTime();

  const byBusiness = new Map<string, IQabSyncStalenessRow[]>();
  for (const row of args.rows) {
    const bucket = byBusiness.get(row.negocioId);
    if (bucket) bucket.push(row);
    else byBusiness.set(row.negocioId, [row]);
  }

  const negocioIds = [...byBusiness.keys()].sort(compareIds);

  return negocioIds.map((negocioId) => {
    const rows = byBusiness.get(negocioId);

    let ultimoContactoMs = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const contacto = row.ultimoContactoOkAt ?? row.createdAt;
      const contactoMs = contacto.getTime();
      if (contactoMs > ultimoContactoMs) ultimoContactoMs = contactoMs;
    }

    const diverged = rows
      .filter((row) => row.hashDivergenteAt !== null)
      .sort((a, b) => compareIds(a.tiendaId, b.tiendaId));

    return {
      negocioId,
      ultimoContactoAt: new Date(ultimoContactoMs),
      stale: nowMs - ultimoContactoMs > thresholdMs,
      divergedTiendaIds: diverged.map((row) => row.tiendaId),
      divergedNombres: diverged.map((row) => row.nombre),
    };
  });
}

/**
 * PURE. What the two notifications of ONE business must look like, or `null` for
 * "this one must not exist".
 *
 * `stalled` is non-null exactly when `state.stale`; `diverged` is non-null
 * exactly when `state.divergedTiendaIds` is non-empty. Both descriptors are a
 * FUNCTION OF THE STATE and of nothing else that moves: no elapsed time, no
 * timestamp inside the text. That is deliberate — the writer only updates a
 * notification whose content changed, and `NotificationService.updateNotification`
 * resets `leidoPor`, so a description carrying the clock would re-mark the alert
 * unread on every run.
 *
 * `fechaInicio` is `now`; `fechaFin` is `now` plus
 * QAB_ALERT_NOTIFICATION_TTL_DAYS, a safety cap and not a real expiry — the
 * writer deletes the row when the condition clears, the same way
 * `processPendingReception` does.
 */
export function planQabAlertNotifications(args: {
  state: IQabBusinessAlertState;
  now: Date;
}): IQabAlertPlan {
  const { state, now } = args;
  const fechaFin = new Date(now.getTime() + QAB_ALERT_NOTIFICATION_TTL_DAYS * MS_PER_DAY);
  const minutes = QAB_SYNC_STALE_THRESHOLD_MS / MS_PER_MINUTE;

  const base = {
    nivelImportancia: ALERT_LEVEL,
    tipo: ALERT_TYPE,
    // Never omitted and never derived from a default: an empty `negociosDestino`
    // means EVERY business in this model. See the F-008 contract § 7.
    negociosDestino: state.negocioId,
    usuariosDestino: NO_USERS,
    accionUrl: QAB_ALERT_ACTION_URL,
    fechaInicio: now,
    fechaFin,
  } as const;

  return {
    stalled: state.stale
      ? {
          ...base,
          titulo: QAB_ALERT_TITLES.syncStalled,
          descripcion: `La sincronización con la tienda online lleva más de ${minutes} minutos sin una corrida exitosa. Los precios y la disponibilidad que ve el comprador pueden estar desactualizados.`,
        }
      : null,
    diverged:
      state.divergedTiendaIds.length > 0
        ? {
            ...base,
            titulo: QAB_ALERT_TITLES.hashDiverged,
            descripcion: `El catálogo publicado no coincide con el de la tienda online en: ${state.divergedNombres.join(NOMBRE_SEPARATOR)}. Sus productos quedaron marcados para reenviarse en la próxima sincronización.`,
          }
        : null,
  };
}
