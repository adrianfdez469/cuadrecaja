import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Asegúrate de tener la configuración de Prisma en `lib/prisma.ts`
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { emitQabCategoryEvents } from "@/lib/qab/qabCatalogEmitters";

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

    // Injected instant: `Categoria` has no `updatedAt` column (ADR 0045).
    const occurredAt = new Date();

    // Same transaction as the write, payload built from the row it returned.
    // A GLOBAL category fans the event out to every business that already
    // synced it, each with ITS OWN `businessId` (criterion 17).
    const updatedCategory = await prisma.$transaction(async (tx) => {
      const updated = await tx.categoria.update({
        where: { id },
        data: { nombre, color },
      });

      await emitQabCategoryEvents(tx, {
        categoria: {
          categoriaId: updated.id,
          nombre: updated.nombre,
          color: updated.color,
        },
        esGlobal: updated.esGlobal,
        ownerNegocioId: updated.negocioId,
        operacion: "UPDATE",
        occurredAt,
      });

      return updated;
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

    const occurredAt = new Date();

    // The event is enqueued BEFORE the row disappears — its payload needs the
    // name and the colour — and inside the same transaction, so a delete that
    // Postgres refuses (a category still holding products) takes the event with
    // it and nothing is announced that did not happen.
    await prisma.$transaction(async (tx) => {
      await emitQabCategoryEvents(tx, {
        categoria: {
          categoriaId: categoria.id,
          nombre: categoria.nombre,
          color: categoria.color,
        },
        esGlobal: categoria.esGlobal,
        ownerNegocioId: categoria.negocioId,
        operacion: "DELETE",
        occurredAt,
      });

      await tx.categoria.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Categoría eliminada correctamente" }, { status: 200 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al eliminar la categoría" }, { status: 500 });
  }
}





