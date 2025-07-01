import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import {prisma} from "@/lib/prisma"; // tu instancia de Prisma
import { authOptions } from "@/utils/authOptions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const { tiendaId } = body;

  if (!tiendaId) {
    return NextResponse.json({ error: "Falta el ID de tienda" }, { status: 400 });
  }

  try {
    // Obtener información del usuario
    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      include: {
        locales: { include: { tienda: true } },
        negocio: true
      }
    });

    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar que la tienda existe y pertenece al negocio del usuario
    const tienda = await prisma.tienda.findUnique({
      where: { id: tiendaId }
    });

    if (!tienda || tienda.negocioId !== usuario.negocio.id) {
      return NextResponse.json({ error: "Tienda no encontrada o no pertenece a tu negocio" }, { status: 404 });
    }

    // Para usuarios SUPER_ADMIN, permitir acceso a cualquier tienda del negocio
    // Para otros usuarios, verificar que estén asociados a la tienda
    if (usuario.rol !== "SUPER_ADMIN") {
      const tiendaAsociada = usuario.locales.find(ut => ut.tienda.id === tiendaId);
      if (!tiendaAsociada) {
        return NextResponse.json({ error: "No tienes acceso a esta tienda" }, { status: 403 });
      }
    }

    // Actualizar el local actual del usuario
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { localActualId: tiendaId },
    });

    return NextResponse.json({ success: true}, {status: 201});
  } catch (error) {
    console.error("Error al cambiar tienda:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
