import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { gastoAdHocCreateSchema } from "@/schemas/gastos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.gestionar", user.rol)) {
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
    const parsed = gastoAdHocCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const gasto = await prisma.gastoCierre.create({
      data: {
        cierreId,
        gastoTiendaId: null,
        nombre: parsed.data.nombre,
        categoria: parsed.data.categoria,
        tipoCalculo: parsed.data.tipoCalculo,
        montoCalculado: parsed.data.montoCalculado,
        monto: parsed.data.monto ?? null,
        porcentaje: parsed.data.porcentaje ?? null,
        esAdHoc: true,
      },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (error) {
    console.error("Error al registrar gasto ad-hoc:", error);
    return NextResponse.json({ error: "Error al registrar gasto" }, { status: 500 });
  }
}
