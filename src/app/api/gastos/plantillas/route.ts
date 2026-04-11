import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { createGastoPlantillaSchema } from "@/schemas/gastos";

export async function GET() {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.gastos.plantillas.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const plantillas = await prisma.gastoPlantilla.findMany({
      where: { negocioId: user.negocio.id },
      include: {
        _count: { select: { asignaciones: { where: { activo: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(plantillas);
  } catch (error) {
    console.error("Error al obtener plantillas de gastos:", error);
    return NextResponse.json({ error: "Error al obtener plantillas" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.gastos.plantillas.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createGastoPlantillaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const plantilla = await prisma.gastoPlantilla.create({
      data: {
        ...parsed.data,
        negocioId: user.negocio.id,
      },
    });

    return NextResponse.json(plantilla, { status: 201 });
  } catch (error) {
    console.error("Error al crear plantilla de gasto:", error);
    return NextResponse.json({ error: "Error al crear plantilla" }, { status: 500 });
  }
}
