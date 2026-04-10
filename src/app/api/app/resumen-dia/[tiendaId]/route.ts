import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/utils/authFromRequest";
import { IResumenDiaResponse } from "@/schemas/resumenDia";

/**
 * GET /api/app/resumen-dia/[tiendaId]?cierreId=<id>&soloConMovimientos=<bool>
 *
 * Devuelve el "Punto de partida y comportamiento" del período activo:
 * para cada producto de la tienda muestra la cantidad inicial (al inicio
 * del período), las ventas, entradas y salidas ocurridas, y la existencia
 * actual (cantidad final).
 *
 * Query params:
 *  - cierreId          (string, requerido) – ID del CierrePeriodo activo.
 *  - soloConMovimientos (bool, default true) – true → solo productos que
 *    tuvieron al menos un movimiento; false → todos los productos con
 *    existencia > 0 o con movimientos.
 *
 * Requiere autenticación por JWT (header Authorization: Bearer <token>).
 */

const TIPOS_ENTRADAS = [
  "COMPRA",
  "TRASPASO_ENTRADA",
  "AJUSTE_ENTRADA",
  "DESAGREGACION_ALTA",
  "CONSIGNACION_ENTRADA",
] as const;

const TIPOS_SALIDAS = [
  "TRASPASO_SALIDA",
  "AJUSTE_SALIDA",
  "DESAGREGACION_BAJA",
  "CONSIGNACION_DEVOLUCION",
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> }
): Promise<NextResponse<IResumenDiaResponse | { error: string }>> {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { tiendaId } = await params;
    const { searchParams } = new URL(request.url);
    const cierreId = searchParams.get("cierreId");
    const soloConMovimientos = searchParams.get("soloConMovimientos") !== "false";

    if (!cierreId) {
      return NextResponse.json(
        { error: "cierreId es requerido" },
        { status: 400 }
      );
    }

    const cierre = await prisma.cierrePeriodo.findUnique({
      where: { id: cierreId },
      select: { fechaInicio: true, fechaFin: true },
    });

    if (!cierre) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 }
      );
    }

    const startOfPeriod = cierre.fechaInicio;
    const endOfPeriod = cierre.fechaFin ?? new Date();

    const [productosTienda, movimientos] = await Promise.all([
      prisma.productoTienda.findMany({
        where: { tiendaId },
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              permiteDecimal: true,
              categoria: { select: { id: true, nombre: true, color: true } },
            },
          },
          proveedor: { select: { nombre: true } },
        },
      }),
      prisma.movimientoStock.findMany({
        where: {
          tiendaId,
          fecha: { gte: startOfPeriod, lte: endOfPeriod },
        },
        select: {
          productoTiendaId: true,
          tipo: true,
          cantidad: true,
          fecha: true,
        },
      }),
    ]);

    // Agrupar movimientos por productoTiendaId
    const movsByPt = new Map<
      string,
      { ventas: number; entradas: number; salidas: number; ultimaModificacion: Date | null }
    >();

    for (const mov of movimientos) {
      if (!movsByPt.has(mov.productoTiendaId)) {
        movsByPt.set(mov.productoTiendaId, {
          ventas: 0,
          entradas: 0,
          salidas: 0,
          ultimaModificacion: null,
        });
      }
      const agg = movsByPt.get(mov.productoTiendaId)!;

      if (mov.tipo === "VENTA") {
        agg.ventas += Math.abs(mov.cantidad);
      } else if ((TIPOS_ENTRADAS as readonly string[]).includes(mov.tipo)) {
        agg.entradas += mov.cantidad;
      } else if ((TIPOS_SALIDAS as readonly string[]).includes(mov.tipo)) {
        agg.salidas += Math.abs(mov.cantidad);
      }

      if (!agg.ultimaModificacion || mov.fecha > agg.ultimaModificacion) {
        agg.ultimaModificacion = mov.fecha;
      }
    }

    const totales = { ventas: 0, entradas: 0, salidas: 0 };

    const productos = productosTienda
      .filter((pt) =>
        soloConMovimientos
          ? movsByPt.has(pt.id)
          : pt.existencia > 0 || movsByPt.has(pt.id)
      )
      .map((pt) => {
        const agg = movsByPt.get(pt.id) ?? {
          ventas: 0,
          entradas: 0,
          salidas: 0,
          ultimaModificacion: null,
        };
        const cantidadFinal = pt.existencia;
        const cantidadInicial =
          cantidadFinal - agg.entradas + agg.ventas + agg.salidas;

        totales.ventas += agg.ventas;
        totales.entradas += agg.entradas;
        totales.salidas += agg.salidas;

        return {
          productoTiendaId: pt.id,
          productoId: pt.producto.id,
          nombre: pt.proveedor
            ? `${pt.producto.nombre} - ${pt.proveedor.nombre}`
            : pt.producto.nombre,
          proveedorNombre: pt.proveedor?.nombre,
          permiteDecimal: pt.producto.permiteDecimal,
          categoriaId: pt.producto.categoria.id,
          categoriaNombre: pt.producto.categoria.nombre,
          categoriaColor: pt.producto.categoria.color,
          tieneMovimientos: movsByPt.has(pt.id),
          ultimaModificacion: agg.ultimaModificacion?.toISOString() ?? null,
          cantidadInicial,
          ventas: agg.ventas,
          entradas: agg.entradas,
          salidas: agg.salidas,
          cantidadFinal,
        };
      });

    return NextResponse.json({ productos, totales });
  } catch (error) {
    console.error("[GET /api/app/resumen-dia]", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
