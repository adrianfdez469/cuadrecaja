import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPermisosUsuario } from '@/utils/getPermisosUsuario';
import { getRolUsuario } from '@/utils/getRolUsuario';

/**
 * POST /api/app/auth/login
 * 
 * Login para la aplicación móvil Flutter.
 * Retorna un token JWT que debe ser enviado en el header Authorization.
 */
export async function POST(request: Request) {
  try {
    const { usuario, password } = await request.json();

    if (!usuario || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

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
          select: { 
            id: true, 
            nombre: true, 
            userlimit: true, 
            limitTime: true, 
            locallimit: true, 
            productlimit: true 
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

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

    // Validación: Usuario debe tener locales asignados (excepto SUPER_ADMIN)
    if (user.rol !== "SUPER_ADMIN") {
      if (localesDisponibles.length === 0) {
        return NextResponse.json(
          { error: 'No tienes locales asignados. Contacta al administrador.' },
          { status: 403 }
        );
      }

      // Verificar si tiene al menos un rol asignado en algún local
      const tieneRolAsignado = await prisma.usuarioTienda.findFirst({
        where: {
          usuarioId: user.id,
          rolId: { not: null }
        },
        select: { id: true }
      });

      if (!tieneRolAsignado) {
        return NextResponse.json(
          { error: 'No tienes un rol asignado. Contacta al administrador.' },
          { status: 403 }
        );
      }
    }

    // Resolver localActual con fallback al primer local disponible
    const localActualResuelto = user.localActual || localesDisponibles[0] || null;

    // Obtener permisos basados en la tienda resuelta
    const permisos = await getPermisosUsuario(user.id, localActualResuelto?.id || null);

    let rol = "";
    if (user.rol === "SUPER_ADMIN") {
      rol = "SUPER_ADMIN";
    } else {
      rol = await getRolUsuario(user.id, localActualResuelto?.id || null);
    }

    // Generar token JWT con la misma estructura que la respuesta (locales reducidos)
    const token = jwt.sign(
      {
        id: user.id,
        rol: rol,
        usuario: user.usuario,
        nombre: user.nombre,
        negocio: user.negocio,
        localActual: localActualResuelto,
        locales: localesDisponibles,
        permisos: permisos
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '7d' }
    );

    // Retornar respuesta
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: rol,
        negocio: user.negocio,
        localActual: localActualResuelto,
        locales: localesDisponibles,
        permisos: permisos
      },
      token: token
    });

  } catch (error) {
    console.error('❌ [APP/AUTH/LOGIN] Error:', error);
    return NextResponse.json(
      { error: 'Error en el servidor' },
      { status: 500 }
    );
  }
}
