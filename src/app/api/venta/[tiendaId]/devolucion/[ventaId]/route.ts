import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { devolucionVentaCreateSchema } from "@/schemas/devolucionVenta";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { CreateMoviento } from "@/lib/movimiento";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; ventaId: string }> },
) {
  try {
    const { tiendaId, ventaId } = await params;
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

    const body = await req.json();
    const parsed = devolucionVentaCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { ventaProductoId, cantidad, motivo } = parsed.data;

    const [tienda, venta] = await Promise.all([
      prisma.tienda.findFirst({
        where: { id: tiendaId, negocioId: user.negocio.id },
        select: { negocio: { select: { monedaBase: true } } },
      }),
      prisma.venta.findFirst({
        where: { id: ventaId, tiendaId },
        include: {
          productos: { include: { producto: true } },
        },
      }),
    ]);
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }
    if (!venta) {
      return NextResponse.json(
        { error: "Venta no encontrada" },
        { status: 404 },
      );
    }

    const vp = venta.productos.find((p) => p.id === ventaProductoId);
    if (!vp) {
      return NextResponse.json(
        { error: "Producto no encontrado en esta venta" },
        { status: 404 },
      );
    }

    const yaDevuelto = await prisma.movimientoStock.aggregate({
      _sum: { cantidad: true },
      where: {
        tipo: "DEVOLUCION_VENTA",
        referenciaId: ventaId,
        productoTiendaId: vp.productoTiendaId,
      },
    });
    const cantidadDevuelta = Math.abs(yaDevuelto._sum.cantidad ?? 0);
    const cantidadDisponible = Math.max(0, vp.cantidad - cantidadDevuelta);

    if (cantidad > cantidadDisponible) {
      return NextResponse.json(
        {
          error: `Solo quedan ${cantidadDisponible} unidad(es) disponibles para devolver`,
        },
        { status: 400 },
      );
    }

    const monedaBase = tienda?.negocio?.monedaBase ?? DEFAULT_CURRENCY;
    // Usamos las tasas vigentes AL MOMENTO DE LA VENTA original, no las de hoy
    const tasasHistoricas = (venta.tasaSnapshot ?? {}) as ITasaSnapshot;

    const monedaCosto = vp.monedaCostoCode ?? monedaBase;
    const monedaPrecio = vp.monedaPrecioCode ?? monedaBase;

    // convertToBase asume tasa=1 si la moneda no está en el snapshot — nunca
    // calcular un reembolso/costo asumiendo 1:1 en silencio si la tasa
    // histórica de la venta original se perdió: es dinero real.
    const monedasSinTasaHistorica = [
      ...new Set([monedaCosto, monedaPrecio]),
    ].filter(
      (m) => m !== monedaBase && m !== "CUP" && tasasHistoricas[m] == null,
    );
    if (monedasSinTasaHistorica.length > 0) {
      return NextResponse.json(
        {
          error: `No se encontró la tasa de cambio histórica de ${monedasSinTasaHistorica.join(", ")} usada en la venta original; no se puede calcular la devolución con precisión.`,
        },
        { status: 422 },
      );
    }

    const costoBase = convertToBase(
      vp.costo,
      monedaCosto,
      tasasHistoricas,
      monedaBase,
    );
    const precioBase = convertToBase(
      vp.precio,
      monedaPrecio,
      tasasHistoricas,
      monedaBase,
    );

    const costoTotal = costoBase * cantidad;
    const montoReembolso = precioBase * cantidad;
    const tasaUsada =
      monedaPrecio === monedaBase ? 1 : (tasasHistoricas[monedaPrecio] ?? 1);

    await CreateMoviento(
      {
        tipo: "DEVOLUCION_VENTA",
        tiendaId,
        usuarioId: user.id,
        referenciaId: ventaId,
        motivo: motivo || "Devolución de venta",
      },
      [
        {
          productoId: vp.producto.productoId,
          cantidad,
          costoTotal,
          montoReembolso,
          monedaOriginal: monedaPrecio,
          montoOriginal: vp.precio * cantidad,
          tasaUsada,
          ...(vp.producto.proveedorId && {
            proveedorId: vp.producto.proveedorId,
          }),
        },
      ],
    );

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Error al registrar devolución de venta:", error);
    return NextResponse.json(
      { error: "Error al registrar la devolución" },
      { status: 500 },
    );
  }
}
