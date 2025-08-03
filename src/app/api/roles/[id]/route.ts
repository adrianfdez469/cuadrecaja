import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getSession } from "@/utils/auth";


// GET - Obtener un rol específico por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const rol = await prisma.rol.findUnique({
      where: {
        id: id
      }
    });

    if (!rol) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    // Solo puede ver roles de su propio negocio (excepto SUPER_ADMIN)
    if (rol.negocioId !== user.negocio.id && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    return NextResponse.json(rol);
  } catch (error) {
    console.error("Error al obtener rol:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar un rol
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if(!verificarPermisoUsuario(user.permisos, 'configuracion.roles.acceder', user.rol)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    const body = await request.json();
    const { nombre, descripcion, permisos } = body;

    // Verificar que el rol existe y pertenece al negocio del usuario
    const existingRol = await prisma.rol.findUnique({
      where: {
        id: id
      }
    });

    if (!existingRol) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    if (existingRol.negocioId !== user.negocio.id && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // Si se está cambiando el nombre, verificar que no exista otro con el mismo nombre
    if (nombre && nombre !== existingRol.nombre) {
      const duplicateRol = await prisma.rol.findUnique({
        where: {
          nombre_negocioId: {
            nombre: nombre,
            negocioId: existingRol.negocioId
          }
        }
      });

      if (duplicateRol) {
        return NextResponse.json(
          { error: "Ya existe un rol con ese nombre en este negocio" },
          { status: 400 }
        );
      }
    }

    const rolActualizado = await prisma.rol.update({
      where: {
        id: id
      },
      data: {
        ...(nombre && { nombre }),
        ...(descripcion !== undefined && { descripcion }),
        ...(permisos && { permisos })
      }
    });

    return NextResponse.json(rolActualizado);
  } catch (error) {
    console.error("Error al actualizar rol:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un rol
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    if(!verificarPermisoUsuario(user.permisos, 'configuracion.roles.acceder', user.rol)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const { id } = await params;

    // Verificar que el rol existe y pertenece al negocio del usuario
    const existingRol = await prisma.rol.findUnique({
      where: {
        id: id
      }
    });

    if (!existingRol) {
      return NextResponse.json({ error: "Rol no encontrado" }, { status: 404 });
    }

    if (existingRol.negocioId !== user.negocio.id && user.rol !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    // TODO: En el futuro, verificar que no haya usuarios asignados a este rol
    // antes de permitir la eliminación

    await prisma.rol.delete({
      where: {
        id: id
      }
    });

    return NextResponse.json({ message: "Rol eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar rol:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 