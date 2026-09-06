import { Prisma } from "@prisma/client";
import {
  QAB_AVAILABILITY_CASE_SQL,
  QAB_AVAILABILITY_MAX_ROWS_PER_RUN,
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_PRODUCT_ENTITY,
} from "@/constants/qab";
import { qabPrisma } from "@/lib/qab/qabPrisma";
import { qabDivergentRowSchema } from "@/schemas/qabAvailability";
import type {
  IQabAvailabilityWritePlan,
  IQabDivergentRow,
} from "@/schemas/qabAvailability";

/**
 * The divergence query. Returns rows already parsed by `qabDivergentRowSchema`.
 * `negocioIds: []` returns `[]` WITHOUT touching the database.
 *
 * Runs on `qabPrisma` (ADR 0015): a scan of the partial index must never hold a
 * connection of the pool the POS reads and writes through.
 *
 * `Prisma.raw` is used for QAB_AVAILABILITY_CASE_SQL and for NOTHING else: the
 * business ids and the limit travel as bound parameters of the tagged template,
 * never interpolated. See ADR 0048.
 *
 * The projection returns the RESULT of the CASE: neither `existencia` nor
 * `umbralBajo` ever leaves the database.
 */
export async function readDivergentAvailabilityRows(args: {
  /** The eligible businesses the cron already computed. Never recomputed here. */
  negocioIds: string[];
  /** Defaults to QAB_AVAILABILITY_MAX_ROWS_PER_RUN. */
  limit?: number;
}): Promise<IQabDivergentRow[]> {
  const { negocioIds } = args;
  if (negocioIds.length === 0) return [];

  const limit = args.limit ?? QAB_AVAILABILITY_MAX_ROWS_PER_RUN;
  const expression = Prisma.raw(QAB_AVAILABILITY_CASE_SQL);

  // `existencia`, "umbralBajo" and "dispPublicada" go WITHOUT an alias prefix,
  // exactly as the partial index writes them; `deletedAt` and `negocioId` exist
  // in more than one of the three tables and are always qualified.
  const rows = await qabPrisma.$queryRaw<unknown[]>`
    SELECT pt."id"       AS "productoTiendaId",
           pt."tiendaId" AS "tiendaId",
           t."negocioId" AS "negocioId",
           (${expression}) AS "availability"
    FROM "ProductoTienda" pt
    JOIN "Tienda" t   ON t."id" = pt."tiendaId"
    JOIN "Producto" p ON p."id" = pt."productoId"
    WHERE (${expression}) IS DISTINCT FROM "dispPublicada"
      AND t."negocioId" = ANY(${negocioIds}::text[])
      AND t."publicarEnTienda" = true
      AND p."publicarEnTienda" = true
      AND pt."deletedAt" IS NULL
      AND p."deletedAt" IS NULL
    ORDER BY pt."id"
    LIMIT ${limit}
  `;

  // `$queryRaw` has no column typing: the shape is validated on the way out, not
  // by the compiler (documented cost of ADR 0048).
  return rows.map((row) => qabDivergentRowSchema.parse(row));
}

/**
 * ProductoTienda ids whose PRODUCT event is still pending AND still retryable.
 * One query, never one per row. `productoTiendaIds: []` returns an empty Set
 * without touching the database. See ADR 0049.
 *
 * `intentos < QAB_OUTBOX_MAX_ATTEMPTS` is not optional: an exhausted event never
 * gets a `procesadoAt`, so without that cut it would block its row's
 * availability for ever.
 */
export async function readProductoTiendaIdsWithPendingProductEvent(args: {
  negocioIds: string[];
  productoTiendaIds: string[];
}): Promise<Set<string>> {
  const { negocioIds, productoTiendaIds } = args;
  if (negocioIds.length === 0 || productoTiendaIds.length === 0) return new Set();

  const rows = await qabPrisma.outboxEvento.findMany({
    where: {
      // The tenant filter is not omitted because `entidadId` happens to be
      // unique: it is the boundary, and it goes in the SQL.
      negocioId: { in: negocioIds },
      entidad: QAB_PRODUCT_ENTITY,
      entidadId: { in: productoTiendaIds },
      procesadoAt: null,
      intentos: { lt: QAB_OUTBOX_MAX_ATTEMPTS },
    },
    select: { entidadId: true },
  });

  return new Set(rows.map((row) => row.entidadId));
}

/**
 * Applies one page's write plan: ONE `updateMany` per group, at most three.
 * Returns the SUM of the counts. `plan.groups: []` writes nothing and returns 0.
 *
 * `tienda: { negocioId }` is NOT omitted, even though the ids come from a query
 * already filtered by that business: they travelled through a third party's
 * response. And there is no `NOT: { dispPublicada }` filter, so the returned
 * count is the number of rows the statement found — which is what the phase
 * publishes as `written`. See ADR 0050.
 */
export async function writeDispPublicada(args: {
  negocioId: string;
  plan: IQabAvailabilityWritePlan;
}): Promise<number> {
  const { negocioId, plan } = args;

  let written = 0;
  for (const group of plan.groups) {
    const { count } = await qabPrisma.productoTienda.updateMany({
      where: { id: { in: group.productoTiendaIds }, tienda: { negocioId } },
      data: { dispPublicada: group.availability },
    });
    written += count;
  }

  return written;
}
