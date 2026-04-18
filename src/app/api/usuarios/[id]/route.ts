import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { Prisma } from "@prisma/client";
import { roles } from "@/utils/roles";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (usuario.estadoCuenta === UsuarioEstadoCuenta.PENDIENTE_VERIFICACION) {
      await prisma.usuarioTienda.deleteMany({ where: { usuarioId: id } });
      await prisma.usuario.delete({ where: { id } });
      return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
    }

    const [countLocales, countVentas, countMovimientos, countProveedores] = await Promise.all([
      prisma.usuarioTienda.count({ where: { usuarioId: id } }),
      prisma.venta.count({ where: { usuarioId: id } }),
      prisma.movimientoStock.count({ where: { usuarioId: id } }),
      prisma.proveedor.count({ where: { usuarioId: id } }),
    ]);

    const razones: string[] = [];
    if (countLocales > 0) {
      razones.push(
        `está asignado a ${countLocales} local(es); quítalo de los locales en configuración`
      );
    }
    if (countVentas > 0) {
      razones.push(`tiene ${countVentas} venta(s) registrada(s) en el sistema`);
    }
    if (countMovimientos > 0) {
      razones.push(`tiene ${countMovimientos} movimiento(s) de inventario asociados`);
    }
    if (countProveedores > 0) {
      razones.push(`está vinculado a ${countProveedores} proveedor(es)`);
    }

    if (razones.length > 0) {
      return NextResponse.json(
        {
          error: `No se puede eliminar el usuario porque ${razones.join("; ")}.`,
        },
        { status: 409 }
      );
    }

    try {
      await prisma.usuario.delete({
        where: { id },
      });
    } catch (deleteErr) {
      if (
        deleteErr instanceof Prisma.PrismaClientKnownRequestError &&
        deleteErr.code === "P2003"
      ) {
        return NextResponse.json(
          {
            error:
              "No se puede eliminar el usuario: aún tiene datos vinculados en el sistema (por ejemplo ventas, movimientos o referencias en otras tablas).",
          },
          { status: 409 }
        );
      }
      throw deleteErr;
    }

    return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
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
    const usuarioNormalizado = typeof usuario === "string" ? usuario.trim().toLowerCase() : "";

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

    let data: Prisma.UsuarioUpdateInput = {};
    if (userId === id) {
      if (typeof usuario === "string" && usuario.trim() !== "") {
        const intento = usuario.trim().toLowerCase();
        if (intento !== usuarioDB.usuario.toLowerCase()) {
          return NextResponse.json(
            { error: "No puedes modificar tu correo de acceso desde aquí." },
            { status: 400 }
          );
        }
      }
      data = {
        ...(nombre ? { nombre } : {}),
        ...(password ? { password: await bcrypt.hash(password, 10) } : {}),
      };
    } else {
      if (
        password &&
        user.rol !== roles.SUPER_ADMIN
      ) {
        return NextResponse.json(
          {
            error:
              "Solo un superadministrador puede asignar o restablecer la contraseña de otro usuario.",
          },
          { status: 403 }
        );
      }
      const hashed = password ? await bcrypt.hash(password, 10) : null;
      data = {
        nombre,
        usuario: usuarioNormalizado,
        ...(hashed
          ? {
              password: hashed,
              ...(usuarioDB.estadoCuenta ===
              UsuarioEstadoCuenta.PENDIENTE_VERIFICACION
                ? { estadoCuenta: UsuarioEstadoCuenta.ACTIVO }
                : {}),
            }
          : {}),
      };
    }

    if (userId !== id && !EMAIL_REGEX.test(usuarioNormalizado)) {
      return NextResponse.json(
        { error: "El campo usuario debe ser un correo electrónico válido." },
        { status: 400 }
      );
    }

    const usuarioSelect = {
      id: true,
      nombre: true,
      usuario: true,
      rol: true,
      negocioId: true,
      localActualId: true,
      isActive: true,
      estadoCuenta: true,
    } satisfies Prisma.UsuarioSelect;

    const nuevoUsuario = await prisma.usuario.update({
      where: { id },
      data,
      select: usuarioSelect,
    });

    return NextResponse.json(nuevoUsuario, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "El usuario/correo ya está en uso. Intenta con otro." },
        { status: 409 }
      );
    }

    console.error(error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
