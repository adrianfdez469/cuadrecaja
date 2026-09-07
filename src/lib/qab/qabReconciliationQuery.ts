import { Prisma } from "@prisma/client";
import {
  QAB_RECONCILIATION_MAX_ROWS_PER_STORE,
  QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL,
  QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL,
} from "@/constants/qab";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import { qabMirrorRowSchema } from "@/schemas/qabReconciliation";
import type {
  IQabMirrorRow,
  IQabReconciliationTarget,
  IQabSyncStalenessRow,
} from "@/schemas/qabReconciliation";

/**
 * Published stores of the given businesses, with the round-robin key. Creates
 * nothing. `negocioIds: []` returns `[]` WITHOUT touching the database.
 *
 * Filters `Tienda.negocioId = ANY(...)` AND `Tienda.publicarEnTienda = true` —
 * the same store-level condition the availability query of F-007 uses. An
 * unpublished store was never created on the other side, so comparing it would
 * only produce UNKNOWN_STORE noise.
 */
export async function readQabReconciliationCandidates(args: {
  negocioIds: string[];
}): Promise<IQabReconciliationTarget[]> {
  const { negocioIds } = args;
  if (negocioIds.length === 0) return [];

  const rows = await qabPrisma.tienda.findMany({
    where: { negocioId: { in: negocioIds }, publicarEnTienda: true },
    select: {
      id: true,
      negocioId: true,
      qabReconciliacion: { select: { ultimaComparacionAt: true } },
    },
    orderBy: { id: "asc" },
  });

  return rows.map((row) => ({
    negocioId: row.negocioId,
    tiendaId: row.id,
    ultimaComparacionAt: row.qabReconciliacion?.ultimaComparacionAt ?? null,
  }));
}

/**
 * Creates the missing `QabReconciliacionTienda` rows, one per target, and
 * returns how many were created.
 *
 * Uses `createMany({ skipDuplicates: true })` on the unique `tiendaId`. Keeping
 * the FIRST write and silently skipping the rest is exactly what is wanted here
 * — the row's `createdAt` is the "first seen" the staleness aggregation falls
 * back to, and re-creating it would reset it every run. (This is the behaviour
 * E-024 warns about, used on purpose and for a create-if-absent, not for a
 * derived row.)
 */
export async function ensureQabReconciliationRows(args: {
  targets: Array<{ negocioId: string; tiendaId: string }>;
}): Promise<number> {
  const { targets } = args;
  if (targets.length === 0) return 0;

  const { count } = await qabPrisma.qabReconciliacionTienda.createMany({
    data: targets.map((target) => ({ tiendaId: target.tiendaId })),
    skipDuplicates: true,
  });

  return count;
}

/**
 * The mirror's row selection. ONE `qabPrisma.$queryRaw` tagged template.
 *
 * `Prisma.raw` for the two mirror fragments and for NOTHING else; `tiendaId` and
 * the limit are bound parameters of the template, never interpolated. Same shape
 * as `readDivergentAvailabilityRows` (ADR 0048), which does exactly this with
 * QAB_AVAILABILITY_CASE_SQL. `$queryRawUnsafe` is NOT used here.
 *
 * The SELECT projects those four columns and no others, not even for debugging:
 * `existencia`, `umbralBajo`, `costo` and the supplier stop at the database, the
 * same discipline `readDivergentAvailabilityRows` documents for its own
 * projection.
 *
 * It takes NO `negocioId`, on purpose and as a declared deviation from the
 * project's rule. See § 7 of the F-008 contract and ADR 0095: adding the tenant
 * join would turn a leak into the hash of an EMPTY store, which is a legitimate
 * value, and therefore into a silent divergence that wipes a whole store. The
 * boundary sits earlier, in `readQabReconciliationCandidates`, and again in the
 * two writes below.
 *
 * `tooLarge` is true when the read came back with more than `maxRows` rows, and
 * then `rows` is `[]`: no caller can hash a truncated selection, because the
 * guard is here and not in the caller's discipline.
 *
 * `$queryRaw*` has no column typing, so each row is validated on the way out
 * with `qabMirrorRowSchema.parse` — the documented cost of ADR 0048.
 *
 * `maxRows` defaults to QAB_RECONCILIATION_MAX_ROWS_PER_STORE.
 */
export async function readQabMirrorRows(args: {
  tiendaId: string;
  maxRows?: number;
}): Promise<{ rows: IQabMirrorRow[]; tooLarge: boolean }> {
  const { tiendaId } = args;
  const maxRows = args.maxRows ?? QAB_RECONCILIATION_MAX_ROWS_PER_STORE;

  const fromJoin = Prisma.raw(QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL);
  const whereTail = Prisma.raw(QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL);

  const rows = await qabPrisma.$queryRaw<unknown[]>`
    SELECT pt."id", pt."precio", pt."monedaPrecioCode", pt."dispPublicada"
    ${fromJoin} ${tiendaId} ${whereTail}
    LIMIT ${maxRows + 1}
  `;

  if (rows.length > maxRows) return { rows: [], tooLarge: true };

  return { rows: rows.map((row) => qabMirrorRowSchema.parse(row)), tooLarge: false };
}

/**
 * THE recovery of acceptance criterion 2. Sets `dispPublicada = NULL` on EVERY
 * `ProductoTienda` row of that store and returns the count.
 *
 * No other filter — not `precio`, not `monedaPrecioCode`, not `deletedAt`. Two
 * reasons: the hash is over the whole set and cannot say which row diverged
 * (criterion 2 says all of them), and any second predicate here would be a
 * second, divergent definition of the mirror.
 *
 * `tienda: { negocioId }` stays even though `tiendaId` came from a tenant-scoped
 * read, exactly as `writeDispPublicada` keeps it (ADR 0050): the write is the
 * boundary, so the boundary is in the SQL. `ProductoTienda` has no `negocioId`
 * column of its own — the tenant axis lives in `Tienda.negocioId`.
 *
 * It does NOT resend anything to QAB. The resend is `syncQabAvailability`
 * (F-007), on the next run of the sync-tienda cron.
 */
export async function clearDispPublicadaForStore(args: {
  negocioId: string;
  tiendaId: string;
}): Promise<number> {
  const { negocioId, tiendaId } = args;

  const { count } = await qabPrisma.productoTienda.updateMany({
    where: { tiendaId, tienda: { negocioId } },
    data: { dispPublicada: null },
  });

  return count;
}

/**
 * Records the outcome of ONE store's attempt. Through `updateMany` with
 * `tienda: { negocioId }`, for the same reason as above — `tiendaId` is unique,
 * but the tenant filter needs the relation and `update` cannot carry it
 * (ADR 0085).
 *
 * Exactly this, and nothing else:
 *
 *  reachedQab | diverged | ultimaComparacionAt | ultimoContactoOkAt | hashDivergenteAt
 *  -----------|----------|---------------------|--------------------|------------------
 *  true       | false    | `at`                | `at`               | set to NULL
 *  true       | true     | `at`                | `at`               | `at` ONLY if it was NULL
 *  true       | null     | `at`                | `at`               | untouched
 *  false      | null     | `at`                | untouched          | untouched
 *
 * `diverged: null` is "there was nothing to compare": an UNKNOWN_STORE, an
 * upstream error, or a `too_large` local read. It never clears and never sets
 * the divergence flag — a store that could not be consulted is not a store that
 * agrees, and it is not a store that diverges either.
 *
 * `hashDivergenteAt` keeps its first value while the divergence lasts, so it
 * reads as "when this was first seen" and the alert's content does not churn.
 */
export async function markQabReconciliationAttempt(args: {
  negocioId: string;
  tiendaId: string;
  at: Date;
  reachedQab: boolean;
  diverged: boolean | null;
}): Promise<void> {
  const { negocioId, tiendaId, at, reachedQab, diverged } = args;
  const where = { tiendaId, tienda: { negocioId } };

  const data: Prisma.QabReconciliacionTiendaUpdateManyMutationInput = {
    ultimaComparacionAt: at,
  };
  if (reachedQab === true) data.ultimoContactoOkAt = at;
  // `diverged === false` and not `!diverged`: with `strict: false` the negation
  // would also swallow `null`, which means "nothing to compare" (E-036).
  if (reachedQab === true && diverged === false) data.hashDivergenteAt = null;

  await qabPrisma.qabReconciliacionTienda.updateMany({ where, data });

  if (reachedQab === true && diverged === true) {
    // A SECOND statement, and not a field of the first: the flag keeps its
    // first value, so the row is only stamped while it is still NULL.
    await qabPrisma.qabReconciliacionTienda.updateMany({
      where: { ...where, hashDivergenteAt: null },
      data: { hashDivergenteAt: at },
    });
  }
}

/**
 * The persisted state of the businesses that are STILL eligible: the read joins
 * `Tienda` and its `Negocio` and filters `qabToken IS NOT NULL` AND
 * `tiendaOnlineHabilitada = true` AND `Tienda.publicarEnTienda = true`.
 *
 * Expressing eligibility as a filter of this read (and not as a cleanup) is what
 * makes a business that switches the online store off stop alerting on the next
 * check, with nothing to delete. `where` over `qabToken` filters by the
 * credential without ever projecting it (ADR 0013).
 *
 * `negocioIds: undefined` reads every eligible business; `negocioIds: []`
 * returns `[]` WITHOUT touching the database.
 */
export async function readQabSyncStalenessRows(args: {
  negocioIds?: string[];
}): Promise<IQabSyncStalenessRow[]> {
  const { negocioIds } = args;
  if (negocioIds !== undefined && negocioIds.length === 0) return [];

  const rows = await qabPrisma.qabReconciliacionTienda.findMany({
    where: {
      tienda: {
        publicarEnTienda: true,
        ...(negocioIds === undefined ? {} : { negocioId: { in: negocioIds } }),
        negocio: { qabToken: { not: null }, tiendaOnlineHabilitada: true },
      },
    },
    select: {
      tiendaId: true,
      ultimoContactoOkAt: true,
      hashDivergenteAt: true,
      createdAt: true,
      tienda: { select: { nombre: true, negocioId: true } },
    },
  });

  return rows.map((row) => ({
    negocioId: row.tienda.negocioId,
    tiendaId: row.tiendaId,
    nombre: row.tienda.nombre,
    ultimoContactoOkAt: row.ultimoContactoOkAt,
    hashDivergenteAt: row.hashDivergenteAt,
    createdAt: row.createdAt,
  }));
}
