import type { IQabPermanentFailure } from "@/schemas/qabSync";

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
