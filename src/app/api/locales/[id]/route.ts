import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.locales.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // Verificar si la tienda existe antes de eliminarla
    const tienda = await prisma.tienda.findUnique({
      where: { id, negocioId: user.negocio.id },
    });

    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 }
      );
    }

    
    const tiendaConRelaciones = await prisma.tienda.findUnique({
      where: { id },
      include: {
        productos: { take: 1 },  // Solo necesitamos saber si existe al menos 1
        ventas: { take: 1 },     // Igual para ventas
      },
    });

    // 2. Si tiene productos o ventas, lanzar error
    if (tiendaConRelaciones?.productos.length || tiendaConRelaciones?.ventas.length) {
      return NextResponse.json(
        { error: "No se puede eliminar la tienda porque tiene productos o ventas asociadas" },
        { status: 500 }
      );
    }

    // 3. Si solo tiene usuarios (o ninguno), proceder a eliminar:
    //    - Primero las relaciones usuario-tienda
    await prisma.usuarioTienda.deleteMany({
      where: { tiendaId: id },
    });

    //    - Luego la tienda
    await prisma.tienda.delete({
      where: { id, negocioId: user.negocio.id },
    });

    return NextResponse.json(
      { message: "Tienda eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al eliminar la tienda" },
      { status: 500 }
    );
  }
}

// Actualizar una tienda existente
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.locales.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, tipo, usuariosRoles } = await req.json();
    console.log('Actualizando con usuariosRoles:', usuariosRoles);

    const updatedTienda = await prisma.tienda.update({
      where: { id },
      data: {
        nombre,
        tipo: tipo || "TIENDA",
        usuarios: {
          // Primero eliminamos todas las relaciones existentes
          deleteMany: {},
          // Luego creamos las nuevas relaciones con roles
          create: usuariosRoles.map((item: { usuarioId: string, rolId?: string }) => ({
            usuario: { connect: { id: item.usuarioId } },
            ...(item.rolId && { rol: { connect: { id: item.rolId } } })
          })),
        },
      },
      include: {
        usuarios: {
          include: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                usuario: true,
                rol: true,
                localActualId: true
              }
            },
            rol: {
              select: {
                id: true,
                nombre: true,
                descripcion: true
              }
            }
          }
        },
      },
    });

    // Asignar localActual a usuarios que no lo tengan
    for (const usuarioTienda of updatedTienda.usuarios) {
      // Si el usuario no tiene localActual asignado, asignarle este local
      if (!usuarioTienda.usuario.localActualId) {
        await prisma.usuario.update({
          where: { id: usuarioTienda.usuario.id },
          data: { localActualId: id }
        });
        console.log(`✅ LocalActual asignado automáticamente al usuario ${usuarioTienda.usuario.nombre} (ID: ${usuarioTienda.usuario.id})`);
      }
    }

    // Formatear la respuesta manteniendo compatibilidad
    const tiendaFormateada = {
      ...updatedTienda,
      usuarios: updatedTienda.usuarios.map((u) => u.usuario), // Compatibilidad
      usuariosTiendas: updatedTienda.usuarios // Nueva estructura con roles
    };
    
    return NextResponse.json(tiendaFormateada, { status: 201 });
  } catch (error) {
    console.log(error);

    return NextResponse.json(
      { error: "Error al actualizar la tienda" },
      { status: 500 }
    );
  }
}
