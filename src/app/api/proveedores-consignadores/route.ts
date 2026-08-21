import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/auth';
import { buildTasaSnapshot, convertToBase, roundBaseToAnchorCents } from '@/lib/currency';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
    }

    const negocioId = user.negocio.id;
    const monedaBase = user.negocio.monedaBase ?? 'CUP';

    const { searchParams } = new URL(request.url);
    const nombre = searchParams.get('nombre');

    const whereClause: { negocioId: string, nombre?: { contains: string, mode: 'insensitive' } } = {
      negocioId,
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

    // Consigned units currently in stock, and what they are worth at cost —
    // the money owed to the supplier if everything on the shelf sold.
    //
    // Derived from ProductoTienda, not from the liquidation rows: those only
    // exist for products sold in a closed period, and each one stores a
    // snapshot of the stock at that moment — so adding them up both misses
    // untouched stock and counts the same units once per closing.
    const stockConsignado = proveedores.length > 0
      ? await prisma.productoTienda.findMany({
        where: {
          proveedorId: { in: proveedores.map((proveedor) => proveedor.id) },
          deletedAt: null,
          // Same guard as the detail endpoint: a row whose master product was
          // deleted holds no stock the supplier can claim.
          producto: { deletedAt: null },
        },
        select: {
          proveedorId: true,
          existencia: true,
          costo: true,
          monedaCostoCode: true,
        },
      })
      : [];

    const tasasCambio = await prisma.tasaCambio.findMany({
      where: { negocioId },
      orderBy: { createdAt: 'desc' },
      distinct: ['monedaCode'],
    });
    const tasasActuales = buildTasaSnapshot(tasasCambio);

    const totalesPorProveedor = new Map<string, { existencia: number; valor: number }>();

    for (const productoTienda of stockConsignado) {
      const costoBase = convertToBase(
        productoTienda.costo,
        productoTienda.monedaCostoCode ?? monedaBase,
        tasasActuales,
        monedaBase,
      );
      const acumulado = totalesPorProveedor.get(productoTienda.proveedorId) ?? { existencia: 0, valor: 0 };

      acumulado.existencia += productoTienda.existencia;
      acumulado.valor += productoTienda.existencia * costoBase;
      totalesPorProveedor.set(productoTienda.proveedorId, acumulado);
    }

    const proveedoresConExistencia = proveedores.map((proveedor) => {
      const totales = totalesPorProveedor.get(proveedor.id);

      return {
        ...proveedor,
        existenciaTotal: totales?.existencia ?? 0,
        valorConsignacion: roundBaseToAnchorCents(totales?.valor ?? 0, tasasActuales, monedaBase),
      };
    });

    return NextResponse.json(proveedoresConExistencia);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
