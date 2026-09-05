import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getSession } from "@/utils/auth";
import { computeCierreTotals } from "@/lib/cierre/computeCierreTotals";
import { loadCierreComputationInput } from "@/lib/cierre/loadCierreInput";
import { persistCierreComputation } from "@/lib/cierre/persistCierreTotals";

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

    // Buscar el último período abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId },
      orderBy: { fechaInicio: "desc" },
      select: { id: true, fechaFin: true },
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

    // The figures are derived before the transaction opens, so the lock and
    // the connection are held only for the writes. Expenses applied through
    // /apply before the close are already persisted and load here too.
    const fechaFin = new Date();
    const loaded = await loadCierreComputationInput(cierreId, user.negocio.id, {
      fechaFinOverride: fechaFin,
    });
    if (!loaded) {
      return NextResponse.json(
        { error: "Período no encontrado" },
        { status: 404 },
      );
    }
    const computation = computeCierreTotals(loaded.input);

    const periodoCerrado = await prisma.$transaction(async (tx) => {
      // The "already closed" check above runs outside the transaction, so two
      // concurrent closes both passed it. Here the period is locked and the
      // check repeated under that lock: the second execution waits, sees the
      // fechaFin already written and aborts before writing anything.
      const [lockedPeriod] = await tx.$queryRaw<
        Array<{ fechaFin: Date | null }>
      >`
        SELECT "fechaFin" FROM "CierrePeriodo"
        WHERE "id" = ${ultimoPeriodo.id}
        FOR UPDATE
      `;
      if (!lockedPeriod || lockedPeriod.fechaFin) {
        throw new Error("PERIOD_ALREADY_CLOSED");
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

      return tx.cierrePeriodo.findUniqueOrThrow({
        where: { id: ultimoPeriodo.id },
      });
    });

    return NextResponse.json(periodoCerrado, { status: 201 });
  } catch (error) {
    // A concurrent close won the race; the period is already closed.
    if (error instanceof Error && error.message === "PERIOD_ALREADY_CLOSED") {
      return NextResponse.json(
        { error: "El período ya fue cerrado" },
        { status: 400 },
      );
    }

    console.error("❌ Error al cerrar el período:", error);
    return NextResponse.json(
      { error: "Error al cerrar el período" },
      { status: 500 },
    );
  }
}
