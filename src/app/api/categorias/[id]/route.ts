import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

// Actualizar una categoría existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const { id } = await params;

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.categorias.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const categoria = await prisma.categoria.findUnique({ where: { id } });

    if (!categoria) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    if (categoria.esGlobal && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No puedes editar categorías globales" }, { status: 403 });
    }

    if (!categoria.esGlobal && categoria.negocioId !== user.negocio.id) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    const { nombre, color } = await req.json();
    const updatedCategory = await prisma.categoria.update({
      where: { id },
      data: { nombre, color },
    });
    return NextResponse.json(updatedCategory);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al actualizar categoría" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.categorias.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const categoria = await prisma.categoria.findUnique({ where: { id } });

    if (!categoria) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    if (categoria.esGlobal && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No puedes eliminar categorías globales" }, { status: 403 });
    }

    if (!categoria.esGlobal && categoria.negocioId !== user.negocio.id) {
      return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    }

    await prisma.categoria.delete({ where: { id } });

    return NextResponse.json({ message: "Categoría eliminada correctamente" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al eliminar la categoría" }, { status: 500 });
  }
}





