import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import {prisma} from "@/lib/prisma"; // tu instancia de Prisma
import { authOptions } from "@/utils/authOptions";
import { hasSuperAdminPrivileges } from "@/utils/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!(await hasSuperAdminPrivileges())) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { negocioId } = body;

  if (!negocioId) {
    return NextResponse.json({ error: "Falta el ID del negocio" }, { status: 400 });
  }

  try {
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { negocioId: negocioId, tiendaActualId: null },
    });

    return NextResponse.json({ success: true}, {status: 201});
  } catch (error) {
    console.error("Error al cambiar el negocio:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
