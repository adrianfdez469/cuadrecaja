import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { devolucionVentaCreateSchema } from "@/schemas/devolucionVenta";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import { CreateMoviento, MOVIMIENTO_TX_OPTIONS } from "@/lib/movimiento";
import {
  claimIdempotencyKey,
  findIdempotentResponse,
  storeIdempotentResponse,
  DuplicateRequestError,
} from "@/lib/idempotency";
import { IDEMPOTENCY_KEY_HEADER } from "@/constants/idempotency";

const IDEMPOTENCY_ENDPOINT = "POST /api/venta/devolucion";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; ventaId: string }> },
) {
  // Declared outside the try so the duplicate-request handler can look the
  // stored response up again.
  let claim: { key: string; scopeId: string; endpoint: string } | undefined;

  try {
    const { tiendaId, ventaId } = await params;
    const session = await getSession();
    const user = session.user;

    const idempotencyKey = req.headers.get(IDEMPOTENCY_KEY_HEADER);
    if (!idempotencyKey) {
      return NextResponse.json(
        { error: `Falta la cabecera ${IDEMPOTENCY_KEY_HEADER}` },
        { status: 400 },
      );
    }
    claim = {
      key: idempotencyKey,
      scopeId: user.negocio.id,
      endpoint: IDEMPOTENCY_ENDPOINT,
    };

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

    // Devolver es acumulativo —"devolver N unidades"— así que repetirlo devuelve
    // el doble. No hay transición de estado que sirva de guarda natural, de ahí
    // la clave de idempotencia.
    const replayed = await findIdempotentResponse(claim);
    if (replayed) {
      return NextResponse.json(
        { ...replayed, duplicado: true },
        { status: 200 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await claimIdempotencyKey(tx, claim);

      await CreateMoviento(
        {
          tipo: "DEVOLUCION_VENTA",
          tiendaId,
          usuarioId: user.id,
          referenciaId: ventaId,
          motivo: motivo || "Devolución de venta",
          batchId: claim.key,
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
        tx,
      );

      await storeIdempotentResponse(tx, claim.key, { ok: true });
    }, MOVIMIENTO_TX_OPTIONS);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    // Otra petición con la misma clave llegó primero: la devolución ya quedó
    // registrada, así que para el cliente esto es un éxito.
    if (error instanceof DuplicateRequestError && claim) {
      const stored = await findIdempotentResponse(claim);
      return stored
        ? NextResponse.json({ ...stored, duplicado: true }, { status: 200 })
        : NextResponse.json(
            { error: "La devolución ya está en curso" },
            { status: 409 },
          );
    }

    console.error("Error al registrar devolución de venta:", error);
    return NextResponse.json(
      { error: "Error al registrar la devolución" },
      { status: 500 },
    );
  }
}
