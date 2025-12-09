import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const negocioId = session.user.negocio.id;
    const [products, categories] = await Promise.all([
      prisma.producto.findMany({ where: { negocioId }, select: { id: true, nombre: true } }),
      prisma.categoria.findMany({ where: { negocioId }, select: { id: true, nombre: true } }),
    ]);
    return NextResponse.json({ products, categories });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Error cargando opciones';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
