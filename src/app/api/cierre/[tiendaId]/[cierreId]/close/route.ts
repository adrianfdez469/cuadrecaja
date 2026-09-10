import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getSession } from "@/utils/auth";
import { computeCierreTotals } from "@/lib/cierre/computeCierreTotals";
import { loadCierreComputationInput } from "@/lib/cierre/loadCierreInput";
import { persistCierreComputation } from "@/lib/cierre/persistCierreTotals";
import { closeCierreSchema } from "@/schemas/cierre";
import {
  deferredSalesEffectiveWhere,
  isSalesCutoffWithinPeriod,
} from "@/lib/cierre/salesCutoff";
import { CIERRE_CLOSE_ERRORS } from "@/constants/cierre";

const PERIOD_ALREADY_CLOSED = "PERIOD_ALREADY_CLOSED";
const SALES_CUTOFF_CHANGED = "SALES_CUTOFF_CHANGED";
const SALES_CUTOFF_OUT_OF_RANGE = "SALES_CUTOFF_OUT_OF_RANGE";
const DEFERRED_SALES_MISMATCH = "DEFERRED_SALES_MISMATCH";

/** Two instants are the same cut when they are the same millisecond, or both absent. */
function sameCutoff(a: Date | null, b: Date | null): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return a.getTime() === b.getTime();
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  try {
    const { tiendaId, cierreId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 },
      );
    }

    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.cierre.cerrar",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    // findFirst con negocioId para no permitir cerrar el período de una
    // tienda de otro negocio.
    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId: user.negocio.id },
      select: { id: true },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }

    // `safeParse`, never `parse`: a thrown ZodError would fall into the final
    // catch and answer 500 where this contract promises 400 — and that catch
    // logs the error, so the ZodError message would publish the received value
    // in the log (E-031).
    // The body is mandatory now, and a malformed one is a 400, not a 500: the
    // parse failure is swallowed here rather than reaching the catch-all, whose
    // `console.error` would publish what the runtime quotes (E-031).
    const rawBody = await req.json().catch(() => null);
    const parsedBody = closeCierreSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Datos de cierre inválidos" },
        { status: 400 },
      );
    }
    const { expectedCutoffAt } = parsedBody.data;

    // Buscar el último período abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        salesCutoffAt: true,
      },
    });

    if (!ultimoPeriodo) {
      return NextResponse.json(
        { error: "No hay períodos para esta tienda" },
        { status: 404 },
      );
    }

    if (ultimoPeriodo.fechaFin) {
      return NextResponse.json(
        { error: "El último período ya está cerrado" },
        { status: 400 },
      );
    }

    if (ultimoPeriodo.id !== cierreId) {
      return NextResponse.json(
        { error: "Período no coincide con el cierre solicitado" },
        { status: 400 },
      );
    }

    // Optimistic check, first pass: fail fast, before loading and computing in
    // vain. The one that really counts is repeated under the lock below.
    if (!sameCutoff(ultimoPeriodo.salesCutoffAt, expectedCutoffAt)) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.salesCutoffChanged },
        { status: 409 },
      );
    }

    const cutoffAt = ultimoPeriodo.salesCutoffAt;

    // ONE clock for the whole request. The range check, the closing instant,
    // the in-memory partition and the SQL of the transfer all cap the effective
    // time of a sale against this same value: with two readings the expected
    // deferred count and the count the updateMany reports would be computed
    // against different clocks, and the optimistic check could abort because
    // time passed rather than because a sale vanished.
    const now = new Date();

    // Defence, not a branch reachable in normal operation: the PATCH already
    // validated the range, and the range is monotonic — fechaInicio does not
    // move and `now` only grows. It exists so no write goes unvalidated.
    if (
      cutoffAt !== null &&
      !isSalesCutoffWithinPeriod(cutoffAt, ultimoPeriodo, now)
    ) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.salesCutoffOutOfRange },
        { status: 400 },
      );
    }

    // The figures are derived before the transaction opens, so the lock and
    // the connection are held only for the writes. Expenses applied through
    // /apply before the close are already persisted and load here too.
    //
    // With a cut, the period ends EXACTLY at the cut: that same instant is what
    // `persistCierreComputation` writes as fechaFin and what the next period
    // starts at, so no cash movement is counted twice nor falls outside both.
    const fechaFin = cutoffAt ?? now;
    const loaded = await loadCierreComputationInput(cierreId, user.negocio.id, {
      fechaFinOverride: fechaFin,
      now,
    });
    if (!loaded) {
      return NextResponse.json(
        { error: "Período no encontrado" },
        { status: 404 },
      );
    }
    const computation = computeCierreTotals(loaded.input);
    const expectedDeferredCount = loaded.deferred.count;

    const resultado = await prisma.$transaction(async (tx) => {
      // Advisory lock per store, FIRST. The close now INSERTS a period too, and
      // `FOR UPDATE` cannot serialise against a concurrent opening — it does not
      // see an INSERT the other transaction has not committed. Same order as
      // /open, the sale POST and `src/lib/movimiento/index.ts`, so there is no
      // cycle.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tiendaId})::bigint)`;

      // The "already closed" check above runs outside the transaction, so two
      // concurrent closes both passed it. Here the period is locked and the
      // check repeated under that lock: the second execution waits, sees the
      // fechaFin already written and aborts before writing anything.
      const [lockedPeriod] = await tx.$queryRaw<
        Array<{ fechaFin: Date | null; salesCutoffAt: Date | null }>
      >`
        SELECT "fechaFin", "salesCutoffAt" FROM "CierrePeriodo"
        WHERE "id" = ${ultimoPeriodo.id}
        FOR UPDATE
      `;
      if (!lockedPeriod || lockedPeriod.fechaFin) {
        throw new Error(PERIOD_ALREADY_CLOSED);
      }
      if (!sameCutoff(lockedPeriod.salesCutoffAt, expectedCutoffAt)) {
        throw new Error(SALES_CUTOFF_CHANGED);
      }

      // Eliminar desgloses de billetes temporales antes de cerrar
      await tx.cashBreakdownCierre.deleteMany({
        where: { cierrePeriodoId: ultimoPeriodo.id },
      });
      await tx.cashBreakdownMoneda.deleteMany({
        where: { cierrePeriodoId: ultimoPeriodo.id },
      });

      await persistCierreComputation(tx, ultimoPeriodo.id, computation, {
        fechaFin,
      });

      let openedPeriod = null;
      let deferredCount = 0;

      if (cutoffAt !== null) {
        // Created WHENEVER there was a cut, even when no sale is left behind:
        // otherwise a COMPRA made after the cut and before the close would fall
        // into no period at all.
        openedPeriod = await tx.cierrePeriodo.create({
          data: { fechaInicio: cutoffAt, tiendaId },
        });

        // The only SQL expression of the cut rule. It needs no tenant clause of
        // its own: cierreId was tied to the store above and the store to the
        // session's business, so no foreign sale is reachable by this `where`.
        const { count } = await tx.venta.updateMany({
          where: {
            cierrePeriodoId: cierreId,
            ...deferredSalesEffectiveWhere(cutoffAt, now),
          },
          data: { cierrePeriodoId: openedPeriod.id },
        });
        deferredCount = count;

        // `<`, never `!==`: a deferred sale that VANISHED between the read and
        // the write aborts the close, which is the failure acceptance criterion
        // 8 asks to provoke. A NEW sale that arrived in that window and is later
        // than the cut gives count > expected and the `where` defers it
        // CORRECTLY — that is the property of the model, not an error.
        if (count < expectedDeferredCount) {
          throw new Error(DEFERRED_SALES_MISMATCH);
        }
      }

      const closedPeriod = await tx.cierrePeriodo.findUniqueOrThrow({
        where: { id: ultimoPeriodo.id },
      });

      return { closedPeriod, openedPeriod, deferredCount };
    });

    return NextResponse.json(
      {
        closedPeriod: resultado.closedPeriod,
        openedPeriod: resultado.openedPeriod,
        deferredCount: resultado.deferredCount,
        deferredTotal: loaded.deferred.totalVentas,
      },
      { status: 201 },
    );
  } catch (error) {
    // A concurrent close won the race; the period is already closed.
    if (error instanceof Error && error.message === PERIOD_ALREADY_CLOSED) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.periodAlreadyClosed },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === SALES_CUTOFF_CHANGED) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.salesCutoffChanged },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message === SALES_CUTOFF_OUT_OF_RANGE) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.salesCutoffOutOfRange },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === DEFERRED_SALES_MISMATCH) {
      return NextResponse.json(
        { error: CIERRE_CLOSE_ERRORS.deferredSalesMismatch },
        { status: 409 },
      );
    }

    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 },
    );
  }
}
