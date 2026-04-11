import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { verificarPermisoUsuario } from '@/utils/permisos_back';

/**
 * POST /api/app/productos/[id]/agregar-codigo
 *
 * Asocia un código de barras desconocido a un producto existente.
 * Requiere el permiso `operaciones.pos-venta.asociar_codigo`.
 *
 * Body: { codigo: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        'operaciones.pos-venta.asociar_codigo',
        user.rol
      )
    ) {
      return NextResponse.json(
        { error: 'No tiene permiso para asociar códigos de barras' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const codigo: string = body?.codigo;

    if (!codigo || typeof codigo !== 'string' || !codigo.trim()) {
      return NextResponse.json(
        { error: 'El campo "codigo" es requerido' },
        { status: 400 }
      );
    }

    const codigoNormalizado = codigo.trim();

    const producto = await prisma.producto.findUnique({
      where: { id, negocioId: user.negocio.id },
    });

    if (!producto) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      );
    }

    const codigoExistente = await prisma.codigoProducto.findUnique({
      where: { codigo: codigoNormalizado },
    });

    if (codigoExistente) {
      return NextResponse.json(
        { error: 'Este código ya está asociado a otro producto' },
        { status: 409 }
      );
    }

    const nuevoCodigo = await prisma.codigoProducto.create({
      data: { codigo: codigoNormalizado, productoId: id },
    });

    console.log(`✅ [APP/PRODUCTOS/AGREGAR-CODIGO] Código "${codigoNormalizado}" asociado al producto ${id} por usuario ${user.id}`);

    return NextResponse.json(
      {
        success: true,
        codigo: nuevoCodigo,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('❌ [APP/PRODUCTOS/AGREGAR-CODIGO] Error:', error);
    return NextResponse.json(
      { error: 'Error al agregar el código al producto' },
      { status: 500 }
    );
  }
}
