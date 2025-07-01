import { prisma } from "@/lib/prisma";
import { getSession, hasPermision } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import getUserFromRequest from "@/utils/getUserFromRequest";


// Eliminar un usuario (DELETE)
export async function DELETE(
  req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  try {

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const user = await getUserFromRequest(req);

    const usuario = await prisma.usuario.findUnique({where: {id, negocioId: user.negocio.id}});
    if(!usuario) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    if ( !(await hasPermision(usuario.rol))) {
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
    const userId = session?.user?.id;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    
    const user = await getUserFromRequest(req);
    const { nombre, rol, usuario, password } = await req.json();

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
        nombre,
        password: await bcrypt.hash(password, 10),
      }
    } else {
      if ( !(await hasPermision(rol))) {
        return NextResponse.json(
          { error: "Acceso no autorizado" },
          { status: 403 }
        );
      }

      data = {
        nombre,
        rol: (rol as string).toUpperCase(),
        usuario,
        password: await bcrypt.hash(password, 10),
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
