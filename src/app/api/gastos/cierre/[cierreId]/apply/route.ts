import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { applyGastosSchema } from "@/schemas/gastos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.cierre.cerrar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: { id: cierreId, tienda: { negocioId: user.negocio.id } },
    });
    if (!cierre) {
      return NextResponse.json({ error: "Cierre no encontrado" }, { status: 404 });
    }
    if (cierre.fechaFin) {
      return NextResponse.json({ error: "El período ya está cerrado" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = applyGastosSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    // Idempotencia: si ya hay gastos recurrentes aplicados, no duplicar
    const yaAplicados = await prisma.gastoCierre.count({
      where: { cierreId, esAdHoc: false },
    });
    if (yaAplicados > 0) {
      return NextResponse.json(
        { error: "Los gastos recurrentes ya fueron aplicados a este cierre" },
        { status: 409 }
      );
    }

    const { gastosToApply } = parsed.data;

    // Obtener los gastos ad-hoc ya registrados para sumarlos al total
    const gastosAdHocExistentes = await prisma.gastoCierre.findMany({
      where: { cierreId, esAdHoc: true },
    });

    await prisma.$transaction(async (tx) => {
      if (gastosToApply.length > 0) {
        await tx.gastoCierre.createMany({
          data: gastosToApply.map((g) => ({
            cierreId,
            gastoTiendaId: g.gastoTiendaId ?? null,
            nombre: g.nombre,
            categoria: g.categoria,
            tipoCalculo: g.tipoCalculo,
            montoCalculado: g.montoCalculado,
            monto: g.monto ?? null,
            porcentaje: g.porcentaje ?? null,
            esAdHoc: false,
          })),
        });
      }

      const totalGastosRecurrentes = gastosToApply.reduce((s, g) => s + g.montoCalculado, 0);
      const totalGastosAdHoc = gastosAdHocExistentes.reduce((s, g) => s + g.montoCalculado, 0);
      const totalGastos = totalGastosRecurrentes + totalGastosAdHoc;

      await tx.cierrePeriodo.update({
        where: { id: cierreId },
        data: {
          totalGastos,
          // totalGananciaFinal se recalcula definitivamente en close/route.ts
          // pero lo pre-calculamos aquí para referencia
          totalGananciaFinal: cierre.totalGanancia - totalGastos,
        },
      });
    });

    const gastosAplicados = await prisma.gastoCierre.findMany({
      where: { cierreId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(gastosAplicados, { status: 201 });
  } catch (error) {
    console.error("Error al aplicar gastos al cierre:", error);
    return NextResponse.json({ error: "Error al aplicar gastos" }, { status: 500 });
  }
}
