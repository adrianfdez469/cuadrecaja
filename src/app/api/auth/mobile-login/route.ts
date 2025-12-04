import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPermisosUsuario } from '@/utils/getPermisosUsuario';
import { getRolUsuario } from '@/utils/getRolUsuario';

export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json();

    // Buscar usuario en la base de datos
    const user = await prisma.usuario.findFirst({
      where: { usuario: usuario },
      include: {
        localActual: true,
        locales: {
          include: {
            tienda: true,
            rol: true
          }
        },
        negocio: {
          select: { id: true, nombre: true, userlimit: true, limitTime: true, locallimit: true, productlimit: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { message: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { message: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }


    // TODO: Revisar si no está expirado el negocio




    // Para usuarios SUPER_ADMIN, obtener todas las tiendas del negocio
    // Para otros usuarios, solo las tiendas asociadas
    let localesDisponibles;
    if (user.rol === "SUPER_ADMIN") {
      const todasLasTiendas = await prisma.tienda.findMany({
        where: { negocioId: user.negocio.id },
        select: {
          id: true,
          nombre: true,
          negocioId: true,
          tipo: true
        }
      });
      localesDisponibles = todasLasTiendas;
    } else {
      localesDisponibles = user.locales.map((t) => ({
        id: t.tienda.id,
        nombre: t.tienda.nombre,
        negocioId: t.tienda.negocioId,
        tipo: t.tienda.tipo
      }));
    }

    // ⚠️ VALIDACIÓN: Usuario debe tener locales asignados (excepto SUPER_ADMIN)
    if (user.rol !== "SUPER_ADMIN") {
      // Verificar si tiene locales asignados
      if (localesDisponibles.length === 0) {
        throw new Error("USUARIO_SIN_CONFIGURAR: No tienes locales (tiendas o almacenes) asignados. Contacta al administrador para completar tu configuración.");
      }

      // Verificar si tiene al menos un rol asignado en algún local
      const tieneRolAsignado = await prisma.usuarioTienda.findFirst({
        where: {
          usuarioId: user.id,
          rolId: { not: null } // Tiene un rol asignado
        },
        select: { id: true }
      });

      if (!tieneRolAsignado) {
        throw new Error("USUARIO_SIN_CONFIGURAR: No tienes un rol asignado en ningún local. Contacta al administrador para completar tu configuración.");
      }
    }

     // Obtener permisos basados en la tienda actual
     const permisos = await getPermisosUsuario(user.id, user.localActual?.id || null);

     let rol = "";

     if (user.rol === "SUPER_ADMIN") {
       rol = "SUPER_ADMIN";
     } else {
       rol = await getRolUsuario(user.id, user.localActual?.id || null)
     }


    // Generar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        rol: user.rol,
        usuario: user.usuario,
        nombre: user.nombre,
        negocio: user.negocio,
        localActual: user.localActual,
        locales: user.locales,
        permisos: permisos
      },
      process.env.NEXTAUTH_SECRET,
      { expiresIn: '7d' }
    );

    // Retornar respuesta en el formato que espera la app
    return NextResponse.json({
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: user.rol,
        negocio: user.negocio,
        localActual: user.locales[0] || null,
        locales: user.locales,
        permisos: user.locales[0]?.rol?.permisos || ''
      },
      token: token
    });
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { message: 'Error en el servidor' },
      { status: 500 }
    );
  }
}