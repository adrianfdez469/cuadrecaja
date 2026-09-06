import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant } from "@/lib/tenantScope";

// 3. Cerrar el período actual y abrir uno nuevo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;

    // F-021, gate A and necessarily so: the raw SQL below has no `where` to fold a tenant clause
    // into, so ownership is resolved BEFORE the transaction opens. No permission — the POS offers
    // this to the cashier when opening the drawer (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    // Usar transacción con lock para prevenir race conditions
    const nuevoPeriodo = await prisma.$transaction(async (tx) => {
      // Advisory lock per store: serialises concurrent openings for this store.
      // `FOR UPDATE` alone is not enough — it locks nothing when the store has no
      // periods yet, and under READ COMMITTED it does not reveal the period
      // another transaction just inserted and has not committed, so two
      // simultaneous openings could leave two open periods.
      // Released when the transaction ends (xact_lock).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tiendaId})::bigint)`;

      // Under the lock this read can no longer be stale.
      const ultimoPeriodos = await tx.$queryRaw<
        Array<{ id: string; fechaFin: Date | null }>
      >`
        SELECT "id", "fechaFin" FROM "CierrePeriodo"
        WHERE "tiendaId" = ${tiendaId}
        ORDER BY "fechaInicio" DESC
        LIMIT 1
        FOR UPDATE
      `;

      const ultimoPeriodo =
        ultimoPeriodos.length > 0 ? ultimoPeriodos[0] : null;

      // Verificar si ya existe un período abierto
      if (ultimoPeriodo && !ultimoPeriodo.fechaFin) {
        throw new Error("PERIODO_ABIERTO");
      }

      // Crear el nuevo período dentro de la transacción
      return tx.cierrePeriodo.create({
        data: {
          fechaInicio: new Date(),
          tiendaId,
        },
      });
    });

    return NextResponse.json(nuevoPeriodo, { status: 201 });
  } catch (error) {
    // Manejar el error específico de período ya abierto
    if (error instanceof Error && error.message === "PERIODO_ABIERTO") {
      return NextResponse.json(
        { error: "Último período continúa abierto" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Error al abrir el período" },
      { status: 500 },
    );
  }
}
