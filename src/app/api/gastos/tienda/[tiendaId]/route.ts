import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { createGastoTiendaSchema } from "@/schemas/gastos";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "operaciones.gastos.ver", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const tienda = await prisma.tienda.findFirst({ where: { id: tiendaId, negocioId: user.negocio.id } });
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const activoParam = searchParams.get("activo");
    const whereActivo =
      activoParam === "true" ? true : activoParam === "false" ? false : undefined;

    const gastos = await prisma.gastoTienda.findMany({
      where: {
        tiendaId,
        ...(whereActivo !== undefined ? { activo: whereActivo } : {}),
      },
      include: { plantilla: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(gastos);
  } catch (error) {
    console.error("Error al obtener gastos de tienda:", error);
    return NextResponse.json({ error: "Error al obtener gastos" }, { status: 500 });
  }
}

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
    const parsed = createGastoTiendaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
    }

    const gasto = await prisma.gastoTienda.create({
      data: {
        ...parsed.data,
        tiendaId,
        negocioId: user.negocio.id,
        plantillaId: null,
      },
      include: { plantilla: true },
    });

    return NextResponse.json(gasto, { status: 201 });
  } catch (error) {
    console.error("Error al crear gasto de tienda:", error);
    return NextResponse.json({ error: "Error al crear gasto" }, { status: 500 });
  }
}
