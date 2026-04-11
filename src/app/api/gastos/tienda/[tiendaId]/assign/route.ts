import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { assignPlantillaSchema } from "@/schemas/gastos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.gestionar", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const tienda = await prisma.tienda.findFirst({ where: { id: tiendaId, negocioId: user.negocio.id } });
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = assignPlantillaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const plantilla = await prisma.gastoPlantilla.findFirst({
      where: { id: parsed.data.plantillaId, negocioId: user.negocio.id },
    });
    if (!plantilla) {
      return NextResponse.json({ error: "Plantilla no encontrada" }, { status: 404 });
    }

    const yaAsignada = await prisma.gastoTienda.findFirst({
      where: { tiendaId, plantillaId: parsed.data.plantillaId },
    });
    if (yaAsignada) {
      return NextResponse.json(
        { error: "Esta plantilla ya está asignada a la tienda" },
        { status: 409 }
      );
    }

    // Validar que el monto/porcentaje sea coherente con el tipoCalculo de la plantilla
    if (plantilla.tipoCalculo === "MONTO_FIJO" && (!parsed.data.monto || parsed.data.monto <= 0)) {
      return NextResponse.json(
        { error: "El monto es requerido y debe ser mayor a 0 para esta plantilla" },
        { status: 400 }
      );
    }
    if (plantilla.tipoCalculo !== "MONTO_FIJO" && (!parsed.data.porcentaje || parsed.data.porcentaje <= 0)) {
      return NextResponse.json(
        { error: "El porcentaje es requerido y debe ser mayor a 0 para esta plantilla" },
        { status: 400 }
      );
    }

    const gasto = await prisma.gastoTienda.create({
      data: {
        tiendaId,
        negocioId: user.negocio.id,
        plantillaId: plantilla.id,
        nombre: plantilla.nombre,
        categoria: plantilla.categoria,
        tipoCalculo: plantilla.tipoCalculo,
        recurrencia: plantilla.recurrencia,
        diaMes: parsed.data.diaMes ?? plantilla.diaMes,
        mesAnio: parsed.data.mesAnio ?? plantilla.mesAnio,
        diaAnio: parsed.data.diaAnio ?? plantilla.diaAnio,
        monto: parsed.data.monto ?? null,
        porcentaje: parsed.data.porcentaje ?? null,
        activo: true,
      },
      include: { plantilla: true },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (error) {
    console.error("Error al asignar plantilla:", error);
    return NextResponse.json({ error: "Error al asignar plantilla" }, { status: 500 });
  }
}
