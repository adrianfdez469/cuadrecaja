import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { startOfNextDay } from "@/utils/date";
import type { IVentaBuscada } from "@/schemas/devolucionVenta";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const { tiendaId } = await params;
    const session = await getSession();
    const user = session.user;

    if (
      !verificarPermisoUsuario(
        user.permisos,
        "operaciones.movimientos.crear.devolucion_venta",
        user.rol,
      )
    ) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const search = searchParams.get("search")?.trim();

    const ventas = await prisma.venta.findMany({
      where: {
        tiendaId,
        ...(fechaInicio && { createdAt: { gte: new Date(fechaInicio) } }),
        ...(fechaFin && {
          createdAt: { lte: startOfNextDay(new Date(fechaFin)) },
        }),
        ...(search && {
          productos: {
            some: {
              producto: {
                producto: { nombre: { contains: search, mode: "insensitive" } },
              },
            },
          },
        }),
      },
      include: {
        productos: {
          include: { producto: { include: { producto: true } } },
        },
        usuario: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const ventaIds = ventas.map((v) => v.id);
    const devoluciones =
      ventaIds.length > 0
        ? await prisma.movimientoStock.findMany({
            where: { tipo: "DEVOLUCION_VENTA", referenciaId: { in: ventaIds } },
            select: {
              referenciaId: true,
              productoTiendaId: true,
              cantidad: true,
            },
          })
        : [];
    const devueltoMap = new Map<string, number>();
    for (const d of devoluciones) {
      const key = `${d.referenciaId}_${d.productoTiendaId}`;
      devueltoMap.set(key, (devueltoMap.get(key) ?? 0) + Math.abs(d.cantidad));
    }

    const resultado: IVentaBuscada[] = ventas.map((v) => ({
      id: v.id,
      createdAt: v.createdAt,
      total: v.total,
      monedaCobro: v.monedaCobro ?? undefined,
      usuarioNombre: v.usuario?.nombre,
      productos: v.productos.map((vp) => {
        const cantidadDevuelta =
          devueltoMap.get(`${v.id}_${vp.productoTiendaId}`) ?? 0;
        return {
          ventaProductoId: vp.id,
          productoTiendaId: vp.productoTiendaId,
          productoId: vp.producto.productoId,
          nombre: vp.producto.producto.nombre,
          cantidad: vp.cantidad,
          cantidadDevuelta,
          cantidadDisponible: Math.max(0, vp.cantidad - cantidadDevuelta),
          costo: vp.costo,
          precio: vp.precio,
          monedaCostoCode: vp.monedaCostoCode,
          monedaPrecioCode: vp.monedaPrecioCode,
        };
      }),
    }));

    return NextResponse.json({ ventas: resultado });
  } catch (error) {
    console.error("Error al buscar ventas:", error);
    return NextResponse.json(
      { error: "Error al buscar ventas" },
      { status: 500 },
    );
  }
}
