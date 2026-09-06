import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";

export async function GET(req: Request, { params }: { params: Promise<{ tiendaId: string }> }) {
  try {
    
    const { tiendaId } = await params;

    // F-021: no permission — receiving transfers is part of the seller's flow (ADR 0078).
    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const movimientos = await prisma.movimientoStock.findMany({
      where: withTenantScope(
        "movimientoStock",
        {
          destinationId: tiendaId,
          tipo: MovimientoTipo.TRASPASO_SALIDA,
          state: 'PENDIENTE'
        },
        scope.negocioId,
      ),
      include: {
        productoTienda: {
          include: {
            producto: {
              include: {
                codigosProducto: {
                  select: {
                    codigo: true
                  }
                }
              }
            },
            tienda: {
              select: {
                id: true,
                nombre: true,
                tipo: true,
              }
            },
            proveedor: true,
          }
        },
        usuario: {
          select: {
            id: true,
            nombre: true,
          }
        }
      },
      orderBy: {
        fecha: 'desc'
      }
    });

    const movs = movimientos.map((m) => {
      return {
        ...m,
        movimientoOrigenId: m.id,
        productoTienda: {
          ...m.productoTienda,
          existencia: m.cantidad
        }
      }
    });

    return NextResponse.json(movs, {status: 200});
  } catch (error) {
    console.error(error);
    
    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 }
    );
  }
}