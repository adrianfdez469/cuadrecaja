import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { NextRequest, NextResponse } from "next/server";
import { UsuarioEstadoCuenta } from "@prisma/client";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { Prisma } from "@prisma/client";
import { sendUserEmailChangeNotification } from "@/lib/userAccount/sendUserEmailChangeNotification";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Info del usuario para confirmación de eliminación (GET)
export async function GET(
  req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos || '', "configuracion.usuarios.deleteOrDisable", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id, negocioId: user.negocio.id, deletedAt: null },
      include: {
        locales: { include: { tienda: { select: { id: true, nombre: true } } } }
      }
    });

    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const [countVentas, countMovimientos, countProveedores] = await Promise.all([
      prisma.venta.count({ where: { usuarioId: id } }),
      prisma.movimientoStock.count({ where: { usuarioId: id } }),
      prisma.proveedor.count({ where: { usuarioId: id } }),
    ]);

    return NextResponse.json({
      id: usuario.id,
      nombre: usuario.nombre,
      usuario: usuario.usuario,
      estadoCuenta: usuario.estadoCuenta,
      locales: usuario.locales.map(l => ({ id: l.tienda.id, nombre: l.tienda.nombre })),
      countVentas,
      countMovimientos,
      countProveedores,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error al obtener usuario" }, { status: 500 });
  }
}

// Eliminar un usuario (DELETE) — soft delete
export async function DELETE(
  req: NextRequest, { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const session = await getSession();
    const user = session.user;

    const usuario = await prisma.usuario.findUnique({ where: { id, negocioId: user.negocio.id, deletedAt: null } });
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (!verificarPermisoUsuario(user.permisos || '', "configuracion.usuarios.deleteOrDisable", user.rol)) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    if (usuario.estadoCuenta === UsuarioEstadoCuenta.PENDIENTE_VERIFICACION) {
      await prisma.usuarioTienda.deleteMany({ where: { usuarioId: id } });
      await prisma.usuario.delete({ where: { id } });
      return NextResponse.json({ message: "Usuario eliminado" }, { status: 200 });
    }

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    const nuevoUsuario = `${usuario.usuario}_ELIMINADO_${dd}-${mm}-${yyyy}`;

    await prisma.$transaction([
      prisma.usuarioTienda.deleteMany({ where: { usuarioId: id } }),
      prisma.usuario.update({
        where: { id },
        data: { deletedAt: now, usuario: nuevoUsuario },
      }),
    ]);

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
    
    const { nombre, usuario } = await req.json();
    const usuarioNormalizado = typeof usuario === "string" ? usuario.trim().toLowerCase() : "";
    const canManageUsers = verificarPermisoUsuario(
      user.permisos || "",
      "configuracion.usuarios.acceder",
      user.rol
    );
    const isEditingSelf = userId === id;

    if (!isEditingSelf && !canManageUsers) {
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

    const wantsToChangeEmail =
      !!usuarioNormalizado && usuarioNormalizado !== usuarioDB.usuario.toLowerCase();

    if (wantsToChangeEmail && !EMAIL_REGEX.test(usuarioNormalizado)) {
      return NextResponse.json(
        { error: "El campo usuario debe ser un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (wantsToChangeEmail) {
      const existing = await prisma.usuario.findUnique({
        where: { usuario: usuarioNormalizado },
        select: { id: true },
      });
      if (existing && existing.id !== usuarioDB.id) {
        return NextResponse.json(
          { error: "El usuario/correo ya está en uso. Intenta con otro." },
          { status: 409 }
        );
      }
    }

    let data: Prisma.UsuarioUpdateInput = {};
    if (isEditingSelf) {
      data = {
        ...(typeof nombre === "string" && nombre.trim() ? { nombre: nombre.trim() } : {}),
      };
    } else {
      data = {
        ...(typeof nombre === "string" && nombre.trim() ? { nombre: nombre.trim() } : {}),
      };

      if (!wantsToChangeEmail && usuarioNormalizado) {
        data.usuario = usuarioNormalizado;
      }
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

    if (wantsToChangeEmail) {
      await sendUserEmailChangeNotification({
        request: req,
        usuarioId: usuarioDB.id,
        usuarioNombre: nuevoUsuario.nombre,
        negocioId: user.negocio.id,
        negocioNombre: user.negocio.nombre ?? "",
        requestedByNombre: user.nombre ?? "",
        requestedByEmail: user.usuario ?? "",
        previousEmail: usuarioDB.usuario,
        newEmail: usuarioNormalizado,
      });
    }

    return NextResponse.json(
      {
        ...nuevoUsuario,
        pendingEmailChange: wantsToChangeEmail,
        pendingEmailValue: wantsToChangeEmail ? usuarioNormalizado : null,
      },
      { status: 201 }
    );
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
