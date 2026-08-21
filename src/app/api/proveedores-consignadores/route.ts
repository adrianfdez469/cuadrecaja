import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const nombre = searchParams.get('nombre');

    const whereClause: { negocioId: string, nombre?: { contains: string, mode: 'insensitive' } } = {
      negocioId: user.negocio.id,
    };

    if (nombre) {
      whereClause.nombre = {
        contains: nombre,
        mode: 'insensitive',
      };
    }
    const proveedores = await prisma.proveedor.findMany({
      where: whereClause,
      include: {
        prodProveedorLiquidacion: {
          include: {
            cierre: true,
            producto: true,
          }
        },
      }
    });

    // Consigned units currently in stock. Derived from ProductoTienda, not from
    // the liquidation rows: those only exist for products sold in a closed
    // period, and each one stores a snapshot of the stock at that moment — so
    // adding them up both misses untouched stock and counts the same units once
    // per closing.
    const existenciaPorProveedor = proveedores.length > 0
      ? await prisma.productoTienda.groupBy({
        by: ['proveedorId'],
        where: {
          proveedorId: { in: proveedores.map((proveedor) => proveedor.id) },
          deletedAt: null,
          // Same guard as the detail endpoint: a row whose master product was
          // deleted holds no stock the supplier can claim.
          producto: { deletedAt: null },
        },
        _sum: { existencia: true },
      })
      : [];

    const existenciaMap = new Map(
      existenciaPorProveedor.map((row) => [row.proveedorId, row._sum.existencia ?? 0]),
    );

    const proveedoresConExistencia = proveedores.map((proveedor) => ({
      ...proveedor,
      existenciaTotal: existenciaMap.get(proveedor.id) ?? 0,
    }));

    return NextResponse.json(proveedoresConExistencia);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
