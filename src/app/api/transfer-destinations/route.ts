import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';
import { verificarPermisoUsuario } from '@/utils/permisos_back';

// Obtener todos los destinos de transferencia de una tienda
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tiendaId = searchParams.get('tiendaId');

    if (!tiendaId) {
      return NextResponse.json({ error: 'tiendaId es requerido' }, { status: 400 });
    }

    const transferDestinations = await prisma.transferDestinations.findMany({
      orderBy: {
        nombre: 'asc'
      },
      where: {
        tiendaId: tiendaId
      }
    });
    return NextResponse.json(transferDestinations);
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al obtener destinos de transferencia' }, { status: 500 });
  }
}

// Crear un nuevo destino de transferencia
export async function POST(request: Request) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.destinostransferencia.acceder", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, descripcion, default: isDefault, tiendaId } = await request.json();

    // Verificar que la tienda pertenece al negocio del usuario
    const tienda = await prisma.tienda.findFirst({
      where: {
        id: tiendaId,
        negocioId: user.negocio.id
      }
    });

    if (!tienda) {
      return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
    }

    // Si se está marcando como default, desmarcar otros destinos de la misma tienda
    if (isDefault) {
      await prisma.transferDestinations.updateMany({
        where: {
          tiendaId: tiendaId,
          default: true
        },
        data: {
          default: false
        }
      });
    }

    const newTransferDestination = await prisma.transferDestinations.create({
      data: { 
        nombre: nombre.trim(), 
        descripcion: descripcion?.trim() || null, 
        default: isDefault, 
        tiendaId 
      },
    });
    return NextResponse.json(newTransferDestination, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: 'Error al crear destino de transferencia' }, { status: 500 });
  }
} 