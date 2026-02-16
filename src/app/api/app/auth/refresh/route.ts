import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { getPermisosUsuario } from '@/utils/getPermisosUsuario';
import { getRolUsuario } from '@/utils/getRolUsuario';

/**
 * POST /api/app/auth/refresh
 * 
 * Refresca el token JWT del usuario.
 * Requiere el token actual en el header Authorization.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Obtener usuario actualizado de la base de datos
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
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
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Obtener locales disponibles
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

    // Resolver localActual con fallback al primer local disponible
    const localActualResuelto = user.localActual || localesDisponibles[0] || null;

    // Obtener permisos actualizados basados en la tienda resuelta
    const permisos = await getPermisosUsuario(user.id, localActualResuelto?.id || null);

    let rol = "";
    if (user.rol === "SUPER_ADMIN") {
      rol = "SUPER_ADMIN";
    } else {
      rol = await getRolUsuario(user.id, localActualResuelto?.id || null);
    }

    // Generar nuevo token JWT con el mismo localActual que se envía en la respuesta
    const token = jwt.sign(
      {
        id: user.id,
        rol: user.rol,
        usuario: user.usuario,
        nombre: user.nombre,
        negocio: user.negocio,
        localActual: localActualResuelto,
        locales: user.locales,
        permisos: permisos
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '7d' }
    );

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
    console.error('❌ [APP/AUTH/REFRESH] Error:', error);
    return NextResponse.json(
      { error: 'Error al refrescar token' },
      { status: 500 }
    );
  }
}
