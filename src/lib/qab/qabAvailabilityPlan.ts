import {
  QAB_AVAILABILITY,
  QAB_AVAILABILITY_BATCH_SIZE,
  QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES,
  QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES,
} from "@/constants/qab";
import type {
  IQabAvailabilityBatch,
  IQabAvailabilityPhaseReport,
  IQabAvailabilityValue,
  IQabAvailabilityWritePlan,
  IQabDivergentRow,
} from "@/schemas/qabAvailability";
import type { IQabAvailabilityPostOutcome } from "@/lib/qab/qabAvailabilityClient";

/** A row of the batch does not belong to the business the batch is addressed to. */
export class QabAvailabilityTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QabAvailabilityTenantMismatchError";
  }
}

/** Separator of the (storeProductId, storeId) key. A character no id can contain. */
const PAIR_KEY_SEPARATOR = " ";

const WHITESPACE_RUN = /\s+/g;

function pairKey(storeProductId: string, storeId: string): string {
  return `${storeProductId}${PAIR_KEY_SEPARATOR}${storeId}`;
}

/**
 * Partitions the divergence rows by business, preserving the row order inside
 * each group. Entries come back ordered by each business's FIRST row, which is
 * the id order the query returned.
 */
export function groupDivergentRowsByNegocio(rows: IQabDivergentRow[]): Array<{
  negocioId: string;
  rows: IQabDivergentRow[];
}> {
  const groups = new Map<string, IQabDivergentRow[]>();
  for (const row of rows) {
    const group = groups.get(row.negocioId);
    if (group) {
      group.push(row);
    } else {
      groups.set(row.negocioId, [row]);
    }
  }
  // Map preserves insertion order, and a business is inserted when its FIRST row
  // is read, so the entries follow the order the query returned.
  return [...groups.entries()].map(([negocioId, groupRows]) => ({
    negocioId,
    rows: groupRows,
  }));
}

/**
 * Splits one business's rows into pages of at most QAB_AVAILABILITY_BATCH_SIZE,
 * preserving order. `[]` in gives `[]` out: an empty page is never produced,
 * because the other side answers 400 to an empty `items`.
 */
export function chunkDivergentRows(rows: IQabDivergentRow[]): IQabDivergentRow[][] {
  const pages: IQabDivergentRow[][] = [];
  for (let index = 0; index < rows.length; index += QAB_AVAILABILITY_BATCH_SIZE) {
    pages.push(rows.slice(index, index + QAB_AVAILABILITY_BATCH_SIZE));
  }
  return pages;
}

/**
 * Wire payload for one page. Throws QabAvailabilityTenantMismatchError when any
 * row's `negocioId` differs from `negocioId`, and when `rows` is empty: the
 * tenant boundary and the non-empty page are invariants of this function, not
 * something the caller has to remember.
 *
 * Each item is written out KEY BY KEY. Spreading a row here is FORBIDDEN: it is
 * what would put `negocioId` — or, the day the row grows one, `existencia` — on
 * the wire by accident.
 */
export function toQabAvailabilityBatch(
  negocioId: string,
  rows: IQabDivergentRow[],
): IQabAvailabilityBatch {
  if (rows.length === 0) {
    throw new QabAvailabilityTenantMismatchError(
      `Availability batch for business ${negocioId} has no items`,
    );
  }

  return {
    businessId: negocioId,
    items: rows.map((row) => {
      if (row.negocioId !== negocioId) {
        throw new QabAvailabilityTenantMismatchError(
          `Store product ${row.productoTiendaId} belongs to another business than the batch it was put in`,
        );
      }
      return {
        storeProductId: row.productoTiendaId,
        storeId: row.tiendaId,
        availability: row.availability,
      };
    }),
  };
}

/**
 * What one page's response authorises writing. Pure and total. The value of
 * every group comes from the SENT row, never from the response, which does not
 * carry it. See ADR 0050.
 *
 * A confirmed pair that matches no sent row — or that matches a sent row's
 * `storeProductId` but not its `storeId` — is IGNORED, without an error and
 * without a log: a third party can never make this run write a row it did not
 * send. A sent row absent from `confirmed` is not written: it stays divergent
 * and the next run reads it again.
 */
export function planAvailabilityWrites(
  sent: IQabDivergentRow[],
  outcome: IQabAvailabilityPostOutcome,
): IQabAvailabilityWritePlan {
  if (outcome.kind === "error") return { groups: [], confirmed: 0 };

  const confirmedPairs = new Set(
    outcome.response.confirmed.map(([storeProductId, storeId]) =>
      pairKey(storeProductId, storeId),
    ),
  );

  const idsByValue = new Map<IQabAvailabilityValue, string[]>();
  let confirmed = 0;

  for (const row of sent) {
    if (!confirmedPairs.has(pairKey(row.productoTiendaId, row.tiendaId))) continue;
    confirmed += 1;
    const ids = idsByValue.get(row.availability);
    if (ids) ids.push(row.productoTiendaId);
    else idsByValue.set(row.availability, [row.productoTiendaId]);
  }

  const groups: IQabAvailabilityWritePlan["groups"] = [];
  // In QAB_AVAILABILITY order, and never an empty group.
  for (const availability of QAB_AVAILABILITY) {
    const productoTiendaIds = idsByValue.get(availability);
    if (productoTiendaIds && productoTiendaIds.length > 0) {
      groups.push({ availability, productoTiendaIds });
    }
  }

  return { groups, confirmed };
}

/** A report with every counter at zero, `capped: false` and `byBusiness` empty. */
export function emptyQabAvailabilityPhaseReport(): IQabAvailabilityPhaseReport {
  return {
    rows: 0,
    capped: false,
    businesses: 0,
    requests: 0,
    confirmed: 0,
    written: 0,
    byBusiness: [],
  };
}

/**
 * PURE. Upper bound, in bytes, of a well-formed response that confirms `items`
 * items: envelope + items * per-entry budget. It exists so the relation between
 * the page size and the response cap is an EXECUTABLE assertion and not a
 * comment somebody has to remember to read. See ADR 0051.
 */
export function maxAvailabilityResponseBytes(items: number): number {
  return (
    QAB_AVAILABILITY_RESPONSE_ENVELOPE_MAX_BYTES +
    items * QAB_AVAILABILITY_CONFIRMED_ENTRY_MAX_BYTES
  );
}

/** PURE. Collapses whitespace runs into a single space and trims. */
export function normalizeSqlWhitespace(sql: string): string {
  return sql.replace(WHITESPACE_RUN, " ").trim();
}
