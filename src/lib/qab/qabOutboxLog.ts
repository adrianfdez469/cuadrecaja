import { QAB_SLUG_LEARN_LOG } from "@/constants/qab";
import type { IQabPermanentFailure, IQabSlugLearnResult } from "@/schemas/qabSync";

/** The one outcome that is an invariant violation, not an ordinary result. */
const TENANT_MISMATCH_OUTCOME: IQabSlugLearnResult["outcome"] = "tenant_mismatch";

/**
 * One line per permanent failure. Ids and codes only: no store name, no payload,
 * no response body - same rule as `logRouteError`.
 * `QAB_PERMANENT_FAILURE entidad=STORE entidadId=<id> negocioId=<id> code=<code> eventId=<id>`
 */
export function logQabPermanentFailure(failure: IQabPermanentFailure): void {
  console.error(
    `QAB_PERMANENT_FAILURE entidad=${failure.entidad} entidadId=${failure.entidadId} negocioId=${failure.negocioId} code=${failure.code} eventId=${failure.eventId}`,
  );
}

/**
 * One line per learning target. Ids and the closed code, nothing else: no
 * `reason`, no `url`, no response body, no slug — the phase's report aggregates
 * every business in one place. Same rule as `logQabPermanentFailure`.
 * `qab.slugLearn negocioId=<id> tiendaId=<id> outcome=<code>`
 */
export function logQabSlugLearnOutcome(result: IQabSlugLearnResult): void {
  const line = `${QAB_SLUG_LEARN_LOG} negocioId=${result.negocioId} tiendaId=${result.tiendaId} outcome=${result.outcome}`;
  // A tenant mismatch is an invariant violation that must never happen, so it is
  // the one outcome loud enough for an error channel.
  if (result.outcome === TENANT_MISMATCH_OUTCOME) console.error(line);
  else console.info(line);
}
