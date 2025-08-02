import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { verificarPermisoUsuario  } from "@/utils/permisos_back";


// Eliminar un usuario (DELETE)
export async function DELETE(
  req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    // const user = await getUserFromRequest(req);
    const session = await getSession();
    const user = session.user;

    const usuario = await prisma.usuario.findUnique({where: {id, negocioId: user.negocio.id}});
    if(!usuario) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if(!verificarPermisoUsuario(user.permisos || '', "configuracion.usuarios.deleteOrDisable", user.rol )) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    // // Verificar que el usuario no está asociado a nunguna tienda o ah realizado una venta
    const usuarioUsado = await prisma.usuario.findUnique({
      where: {id},
      include: {
        locales: {take: 1},
        //tiendas: {take: 1},
        ventas: {take: 1}
      }
    });

    if(usuarioUsado?.locales?.length || usuarioUsado?.ventas.length) {
      return NextResponse.json(
        { error: "No se puede eliminar el usuario porque tiene ventas asociadas o está en alguna tienda" },
        { status: 500 }
      );
    }

    await prisma.usuario.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    
    const session = await getSession();
    const user = session?.user;
    const userId = session?.user?.id;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    
    // const user = await getUserFromRequest(req);
    const { nombre, usuario, password } = await req.json();

    if(!verificarPermisoUsuario(user.permisos, "configuracion.usuarios.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const usuarioDB = await prisma.usuario.findUnique({where: {id, negocioId: user.negocio.id}});
    if(!usuarioDB) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    let data = {};
    if(userId === id ){
      data = {
        ...(nombre ? {nombre} : {}),
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      }
    } else {
      if(password && !verificarPermisoUsuario(user.permisos, "configuracion.usuarios.cambiarpassword", user.rol)) {
        return NextResponse.json(
          { error: "Acceso no autorizado a cambiar contraseñas" },
          { status: 403 }
        );
      }
      if(!verificarPermisoUsuario(user.permisos, "configuracion.usuarios.acceder", user.rol)) {
        return NextResponse.json(
          { error: "Acceso no autorizado" },
          { status: 403 }
        );
      }

      data = {
        nombre,
        usuario,
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      }
    }

    const nuevoUsuario = await prisma.usuario.update({
      where: { id },
      data
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
