import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';

/**
 * GET /api/app/productos/[tiendaId]
 * 
 * Obtiene todos los productos disponibles para venta en una tienda.
 * Incluye categorías, códigos de barras, existencias y precios.
 * Requiere autenticación por token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tiendaId } = await params;

    if (!tiendaId) {
      return NextResponse.json(
        { error: 'tiendaId es requerido' },
        { status: 400 }
      );
    }

    const user = session.user;

    // Verificar si el usuario está asociado a un proveedor
    const proveedores = await prisma.proveedor.findMany({
      where: {
        usuarioId: user.id
      }
    });

    const filter: { proveedor?: { id: { in: string[] } } } = {};
    if (proveedores.length > 0) {
      // Solo mostrar los productos de los proveedores asociados al usuario
      filter.proveedor = {
        id: {
          in: proveedores.map(proveedor => proveedor.id)
        }
      };
    }

    const productosTienda = await prisma.productoTienda.findMany({
      where: {
        tiendaId: tiendaId,
        ...filter
      },
      include: {
        producto: {
          include: {
            categoria: true,
            codigosProducto: true,
            fraccionDe: {
              select: {
                id: true,
                nombre: true
              }
            }
          }
        },
        proveedor: {
          select: {
            id: true,
            nombre: true
          }
        }
      },
      omit: { precio: proveedores.length > 0 },
      orderBy: {
        producto: {
          nombre: 'asc'
        }
      }
    });

    // Estructurar respuesta optimizada para la app
    const productos = productosTienda.map((pt) => ({
      id: pt.id,
      productoId: pt.productoId,
      nombre: pt.producto.nombre,
      descripcion: pt.producto.descripcion,
      precio: pt.precio,
      costo: pt.costo,
      existencia: pt.existencia,
      permiteDecimal: pt.producto.permiteDecimal,
      categoria: pt.producto.categoria ? {
        id: pt.producto.categoria.id,
        nombre: pt.producto.categoria.nombre,
        color: pt.producto.categoria.color
      } : null,
      codigos: pt.producto.codigosProducto.map(c => ({
        id: c.id,
        codigo: c.codigo,
        productoId: c.productoId
      })),
      proveedor: pt.proveedor ? {
        id: pt.proveedor.id,
        nombre: pt.proveedor.nombre
      } : null,
      esFraccion: !!pt.producto.fraccionDeId,
      fraccionDe: pt.producto.fraccionDe ? {
        id: pt.producto.fraccionDe.id,
        nombre: pt.producto.fraccionDe.nombre
      } : null,
      unidadesPorFraccion: pt.producto.unidadesPorFraccion
    }));

    return NextResponse.json({
      success: true,
      productos: productos,
      total: productos.length
    });

  } catch (error) {
    console.error('❌ [APP/PRODUCTOS] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    );
  }
}
