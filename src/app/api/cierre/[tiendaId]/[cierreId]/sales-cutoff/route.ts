import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant } from "@/lib/tenantScope";
import { setSalesCutoffSchema } from "@/schemas/cierre";
import { isSalesCutoffWithinPeriod } from "@/lib/cierre/salesCutoff";

/** Two instants are the same cut when they are the same millisecond, or both absent. */
function sameCutoff(a: Date | null, b: Date | null): boolean {
  if (a === null || a === undefined) return b === null || b === undefined;
  if (b === null || b === undefined) return false;
  return a.getTime() === b.getTime();
}

/**
 * PATCH /api/cierre/[tiendaId]/[cierreId]/sales-cutoff
 *
 * Sets, moves or clears the cut of an OPEN period: the instant up to which the
 * close takes its sales. Everything after it is deferred to the period the
 * close creates, which starts exactly here.
 *
 * No sale id ever travels in this request — the whole new surface is one
 * timestamp — and no branch that answers 4xx writes anything: the `updateMany`
 * is the only write and it is the last thing that happens.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
): Promise<NextResponse> {
  try {
    const { tiendaId, cierreId } = await params;

    // Same permission as closing and as renaming: whoever can close the period
    // can prepare the close.
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: "operaciones.cierre.cerrar",
    });
    if (!scope) return response;

    // A malformed body is a 400, not a 500: the parse failure never reaches a
    // logger that would quote what the runtime read (E-031).
    const rawBody = await req.json().catch(() => null);
    const parsed = setSalesCutoffSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: "Corte no válido" }, { status: 400 });
    }
    const { target, expectedCutoffAt } = parsed.data;

    // The store is already resolved against the session's business, so the
    // cierreId of the path can never reach a row of another one.
    const periodo = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tiendaId: scope.tiendaId },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        salesCutoffAt: true,
      },
    });
    if (!periodo) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 },
      );
    }
    if (periodo.fechaFin !== null) {
      return NextResponse.json(
        { error: "El período ya está cerrado" },
        { status: 400 },
      );
    }

    // Optimistic check. Two cashiers can have the dialog open at once; without
    // this the last one silently wins and the first never finds out.
    if (!sameCutoff(periodo.salesCutoffAt, expectedCutoffAt)) {
      return NextResponse.json(
        { error: "El corte cambió: recarga la pantalla" },
        { status: 409 },
      );
    }

    const salesCutoffAt =
      target.mode === "clear"
        ? null
        : target.mode === "now"
          ? new Date()
          : target.cutoffAt;

    if (
      salesCutoffAt !== null &&
      !isSalesCutoffWithinPeriod(salesCutoffAt, periodo, new Date())
    ) {
      return NextResponse.json(
        { error: "El corte no cae dentro del período" },
        { status: 400 },
      );
    }

    // The expected cut travels in the `where` too, so the check above is not a
    // race lost between the read and the write.
    const { count } = await prisma.cierrePeriodo.updateMany({
      where: {
        id: cierreId,
        tiendaId: scope.tiendaId,
        fechaFin: null,
        salesCutoffAt: expectedCutoffAt,
      },
      data: { salesCutoffAt },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "El corte cambió: recarga la pantalla" },
        { status: 409 },
      );
    }

    return NextResponse.json({ cutoffAt: salesCutoffAt });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al guardar el corte del cierre" },
      { status: 500 },
    );
  }
}
