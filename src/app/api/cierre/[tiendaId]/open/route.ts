import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 3. Cerrar el período actual y abrir uno nuevo
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: "Tienda ID es requerido" },
        { status: 400 },
      );
    }

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
