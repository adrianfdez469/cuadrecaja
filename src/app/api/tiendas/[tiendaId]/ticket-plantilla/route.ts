import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario, verificarPermisosUsuario } from "@/utils/permisos_back";
import {
  DEFAULT_TICKET_PLANTILLA,
  updateTicketPlantillaSchema,
} from "@/schemas/ticketPlantilla";

async function assertTiendaAccess(tiendaId: string, negocioId: string) {
  return prisma.tienda.findFirst({
    where: { id: tiendaId, negocioId },
    select: { id: true, nombre: true },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const session = await getSession();
    const user = session.user;
    const { tiendaId } = await params;

    if (
      !verificarPermisosUsuario(
        user.permisos,
        [
          "configuracion.ticket.editar",
          "operaciones.pos-venta.imprimir",
          "operaciones.pos-venta.acceder",
        ],
        user.rol,
      )
    ) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const tienda = await assertTiendaAccess(tiendaId, user.negocio.id);
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    const plantilla = await prisma.ticketPlantilla.findUnique({
      where: { tiendaId },
    });

    if (!plantilla) {
      return NextResponse.json({
        tiendaId,
        ...DEFAULT_TICKET_PLANTILLA,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      ...plantilla,
      updatedAt: plantilla.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al obtener plantilla de ticket" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const session = await getSession();
    const user = session.user;
    const { tiendaId } = await params;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "configuracion.ticket.editar",
        user.rol,
      )
    ) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const tienda = await assertTiendaAccess(tiendaId, user.negocio.id);
    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateTicketPlantillaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const plantilla = await prisma.ticketPlantilla.upsert({
      where: { tiendaId },
      create: {
        tiendaId,
        encabezado: data.encabezado ?? null,
        pie: data.pie ?? null,
        mostrarNegocio: data.mostrarNegocio,
        mostrarTienda: data.mostrarTienda,
        mostrarCajero: data.mostrarCajero,
        mostrarDescuentos: data.mostrarDescuentos,
        mostrarMultimoneda: data.mostrarMultimoneda,
        mostrarTasas: data.mostrarTasas,
        mostrarTotalesSecundarios: data.mostrarTotalesSecundarios,
        anchoPapel: data.anchoPapel,
        logoUrl: data.logoUrl ?? null,
      },
      update: {
        encabezado: data.encabezado ?? null,
        pie: data.pie ?? null,
        mostrarNegocio: data.mostrarNegocio,
        mostrarTienda: data.mostrarTienda,
        mostrarCajero: data.mostrarCajero,
        mostrarDescuentos: data.mostrarDescuentos,
        mostrarMultimoneda: data.mostrarMultimoneda,
        mostrarTasas: data.mostrarTasas,
        mostrarTotalesSecundarios: data.mostrarTotalesSecundarios,
        anchoPapel: data.anchoPapel,
        logoUrl: data.logoUrl ?? null,
      },
    });

    return NextResponse.json({
      ...plantilla,
      updatedAt: plantilla.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error al guardar plantilla de ticket" },
      { status: 500 },
    );
  }
}
