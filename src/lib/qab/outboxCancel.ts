// `Prisma` is used as a TYPE only here: `Prisma.TransactionClient`. No value of
// the namespace is needed, unlike `outboxDrain.ts` which also calls `Prisma.join`.
import type { Prisma } from "@prisma/client";
import {
  QAB_EXCHANGE_RATE_ENTITY,
  QAB_OUTBOX_CANCEL_MAX_ROWS,
} from "@/constants/qab";
import { logQabExchangeRateCancel } from "@/lib/qab/qabOutboxLog";
import type { IOutboxEvento, IQabOutboxEntity } from "@/schemas/qabOutbox";

/**
 * The five columns the cancellation reads. `payload` is NOT one of them, and
 * that is what makes acceptance criterion 11 structural rather than a rule to
 * remember: this module never holds a payload, so no exception of its own can
 * quote one. See ADR 0101 § 4.
 */
export type IQabOutboxCancelCandidate = Pick<
  IOutboxEvento,
  "id" | "negocioId" | "entidad" | "entidadId" | "procesadoAt"
>;

/** The (business, currency) key whose pending EXCHANGE_RATE rows are superseded. */
export interface IQabExchangeRateCancelTarget {
  negocioId: string;
  /** `Moneda.code`, which is the `entidadId` of an EXCHANGE_RATE event (ADR 0046). */
  code: string;
}

export interface IQabExchangeRateCancelResult {
  /** Rows the DELETE actually removed. Zero is a normal outcome, not a failure. */
  cancelled: number;
  /**
   * The read reached QAB_OUTBOX_CANCEL_MAX_ROWS. It does NOT assert that more
   * rows exist: the read does not look past its cap. Whatever is left stays
   * pending and the next registration considers it again.
   */
  capReached: boolean;
}

/**
 * A row exactly as the read below returns it: `id` is still a BigInt here and
 * `entidad` is an untyped text column. Declared by hand, like `IOutboxEventoRow`
 * in `outboxDrain.ts`, because `$queryRaw` does not type columns.
 */
interface IQabOutboxCancelRow {
  id: bigint;
  negocioId: string;
  entidad: string;
  entidadId: string;
  procesadoAt: Date | null;
}

/**
 * PURE. Is this candidate a pending EXCHANGE_RATE of the target key?
 * True when ALL FOUR hold:
 *   candidate.negocioId === target.negocioId
 *   candidate.entidad === QAB_EXCHANGE_RATE_ENTITY
 *   candidate.entidadId === target.code
 *   candidate.procesadoAt === null
 *
 * `procesadoAt === null` is the definition of "pending" fixed by the truth table
 * of ADR 0011: the only case there that writes `procesadoAt` is "the id came
 * back in response.ok". This function does not restate that definition, it uses
 * it. There is NO condition on `intentos`, deliberately (ADR 0100 § 1), so an
 * exhausted row is a candidate too.
 *
 * Comparison is strict equality on all three strings, case sensitive, with no
 * trimming and no normalisation. Never throws and never validates: a candidate
 * that does not match is returned as false, not rejected.
 */
export function isSupersededExchangeRateEvent(
  candidate: IQabOutboxCancelCandidate,
  target: IQabExchangeRateCancelTarget,
): boolean {
  return (
    candidate.negocioId === target.negocioId &&
    candidate.entidad === QAB_EXCHANGE_RATE_ENTITY &&
    candidate.entidadId === target.code &&
    candidate.procesadoAt === null
  );
}

/**
 * PURE. The ids to cancel, in the order the candidates came in. Returns `[]` for
 * `candidates: []`. This is the AUTHORITY over what gets deleted: the DELETE is
 * built from this list, never from the read's own WHERE (ADR 0101 § 2).
 * Never throws.
 */
export function selectSupersededExchangeRateEventIds(
  candidates: IQabOutboxCancelCandidate[],
  target: IQabExchangeRateCancelTarget,
): string[] {
  return candidates
    .filter((candidate) => isSupersededExchangeRateEvent(candidate, target))
    .map((candidate) => candidate.id);
}

/**
 * The read's row shape, in the shape the pure function takes. Two conversions,
 * both of them narrowing what raw SQL leaves untyped:
 *
 *  - `id` becomes its decimal string, so no BigInt escapes towards the pure
 *    function (E-003). The BigInt itself is KEPT by the caller for the DELETE:
 *    it is never rebuilt with `BigInt(<string>)`, whose SyntaxError quotes the
 *    string it was given (E-031).
 *  - `entidad` is asserted to the closed vocabulary, like `claimOutboxBatch`
 *    does. The read's WHERE binds it to QAB_EXCHANGE_RATE_ENTITY, so the column
 *    can only come back with that value.
 */
function toQabOutboxCancelCandidate(row: IQabOutboxCancelRow): IQabOutboxCancelCandidate {
  return {
    id: row.id.toString(),
    negocioId: row.negocioId,
    entidad: row.entidad as IQabOutboxEntity,
    entidadId: row.entidadId,
    procesadoAt: row.procesadoAt,
  };
}

/**
 * Deletes the pending EXCHANGE_RATE rows of `target`, INSIDE the caller's
 * transaction. Three steps, in this order (ADR 0101):
 *   1. read the candidates with FOR UPDATE SKIP LOCKED, capped at
 *      QAB_OUTBOX_CANCEL_MAX_ROWS, ordered by id;
 *   2. ask `selectSupersededExchangeRateEventIds` which ones to cancel;
 *   3. delete by id, repeating the key in the `where`.
 *
 * SKIP LOCKED means a row the drain has already claimed is not nominated at all:
 * the merchant's transaction does not wait on the drain's row lock, and that row
 * is not cancelled — which is the case the spec puts out of scope.
 *
 * Takes `Prisma.TransactionClient` and not `PrismaClientLike`: `$queryRaw` is
 * never called on that union anywhere in this repository, and the cancellation
 * has to happen in the same transaction as the enqueue, so a non-transactional
 * client cannot satisfy the contract.
 *
 * Has NO try/catch: a database failure propagates and the caller's transaction
 * rolls back, taking the deletion with it. Calls `logQabExchangeRateCancel`
 * before returning, and ONLY when `cancelled > 0 || capReached`.
 *
 * What this bounds is the window between registering the new rate and the next
 * drain run. It is one of the two layers of S-005/S-006 and does not cover a row
 * already in flight to QAB, nor one QAB already applied and acknowledged.
 */
export async function cancelSupersededExchangeRateEvents(
  tx: Prisma.TransactionClient,
  target: IQabExchangeRateCancelTarget,
): Promise<IQabExchangeRateCancelResult> {
  const rows = await tx.$queryRaw<IQabOutboxCancelRow[]>`
    SELECT o.id, o."negocioId", o.entidad, o."entidadId", o."procesadoAt"
    FROM "OutboxEvento" o
    WHERE o."negocioId" = ${target.negocioId}
      AND o.entidad = ${QAB_EXCHANGE_RATE_ENTITY}
      AND o."entidadId" = ${target.code}
      AND o."procesadoAt" IS NULL
    ORDER BY o.id
    LIMIT ${QAB_OUTBOX_CANCEL_MAX_ROWS}
    FOR UPDATE SKIP LOCKED
  `;

  const capReached = rows.length >= QAB_OUTBOX_CANCEL_MAX_ROWS;

  const candidates = rows.map(toQabOutboxCancelCandidate);
  const cancelIds = new Set(selectSupersededExchangeRateEventIds(candidates, target));
  const idsToDelete = rows.filter((row) => cancelIds.has(row.id.toString())).map((row) => row.id);

  let cancelled = 0;
  if (idsToDelete.length > 0) {
    // The key is repeated here on purpose: the third of the three layers that
    // carry `negocioId` as a value of the query (ADR 0101, security section).
    // A disagreement between the three can only cancel LESS than it should.
    const { count } = await tx.outboxEvento.deleteMany({
      where: {
        id: { in: idsToDelete },
        negocioId: target.negocioId,
        entidad: QAB_EXCHANGE_RATE_ENTITY,
        entidadId: target.code,
        procesadoAt: null,
      },
    });
    cancelled = count;
  }

  if (cancelled > 0 || capReached) {
    logQabExchangeRateCancel({
      negocioId: target.negocioId,
      entidadId: target.code,
      cancelled,
      capReached,
    });
  }

  return { cancelled, capReached };
}
