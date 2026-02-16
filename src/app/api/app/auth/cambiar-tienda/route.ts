import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { getPermisosUsuario } from '@/utils/getPermisosUsuario';
import { getRolUsuario } from '@/utils/getRolUsuario';

/**
 * POST /api/app/auth/cambiar-tienda
 * 
 * Cambia la tienda/local actual del usuario.
 * Requiere el token en el header Authorization.
 * Body: { tiendaId: string }
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

    const { tiendaId } = await request.json();

    if (!tiendaId) {
      return NextResponse.json(
        { error: 'tiendaId es requerido' },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Verificar que el usuario tiene acceso a esta tienda
    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
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

    // Verificar acceso a la tienda
    let tieneAcceso = false;
    let tiendaSeleccionada = null;

    if (user.rol === "SUPER_ADMIN") {
      // SUPER_ADMIN tiene acceso a todas las tiendas del negocio
      tiendaSeleccionada = await prisma.tienda.findFirst({
        where: { 
          id: tiendaId,
          negocioId: user.negocio.id 
        }
      });
      tieneAcceso = !!tiendaSeleccionada;
    } else {
      // Verificar que la tienda está en los locales asignados
      const localAsignado = user.locales.find(l => l.tienda.id === tiendaId);
      if (localAsignado) {
        tieneAcceso = true;
        tiendaSeleccionada = localAsignado.tienda;
      }
    }

    if (!tieneAcceso || !tiendaSeleccionada) {
      return NextResponse.json(
        { error: 'No tienes acceso a esta tienda' },
        { status: 403 }
      );
    }

    // Actualizar el local actual del usuario en la base de datos
    await prisma.usuario.update({
      where: { id: userId },
      data: { localActualId: tiendaId }
    });

    // Obtener permisos actualizados para la nueva tienda
    const permisos = await getPermisosUsuario(user.id, tiendaId);

    let rol = "";
    if (user.rol === "SUPER_ADMIN") {
      rol = "SUPER_ADMIN";
    } else {
      rol = await getRolUsuario(user.id, tiendaId);
    }

    // Generar nuevo token con el local actualizado
    const token = jwt.sign(
      {
        id: user.id,
        rol: user.rol,
        usuario: user.usuario,
        nombre: user.nombre,
        negocio: user.negocio,
        localActual: tiendaSeleccionada,
        locales: user.locales,
        permisos: permisos
      },
      process.env.NEXTAUTH_SECRET!,
      { expiresIn: '7d' }
    );

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

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        rol: rol,
        negocio: user.negocio,
        localActual: tiendaSeleccionada,
        locales: localesDisponibles,
        permisos: permisos
      },
      token: token
    });

  } catch (error) {
    console.error('❌ [APP/AUTH/CAMBIAR-TIENDA] Error:', error);
    return NextResponse.json(
      { error: 'Error al cambiar tienda' },
      { status: 500 }
    );
  }
}
