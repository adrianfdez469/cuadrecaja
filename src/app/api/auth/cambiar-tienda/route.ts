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
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { tiendaActualId: tiendaId },
    });

    return NextResponse.json({ success: true}, {status: 201});
  } catch (error) {
    console.error("Error al cambiar tienda:", error);
    return NextResponse.json({ error: "Error del servidor" }, { status: 500 });
  }
}
