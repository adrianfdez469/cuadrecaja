import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { movimientoId, motivo } = await req.json();

    if (!movimientoId) {
      return NextResponse.json({ error: "ID de movimiento requerido" }, { status: 400 });
    }

    // 1. Buscar el movimiento original (debe ser un TRASPASO_SALIDA PENDIENTE)
    const movimientoOriginal = await prisma.movimientoStock.findUnique({
      where: { id: movimientoId },
      include: {
        productoTienda: true
      }
    });

    if (!movimientoOriginal) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    if (movimientoOriginal.state !== 'PENDIENTE' || movimientoOriginal.tipo !== MovimientoTipo.TRASPASO_SALIDA) {
      return NextResponse.json({ error: "El movimiento no puede ser rechazado en su estado actual" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // 2. Marcar el movimiento original como RECHAZADO
      // Nota: Asegúrate de que 'RECHAZADO' sea un valor válido en tu esquema Prisma para el campo 'state'
      // Si no existe, podrías usar un campo motivo o similar, pero aquí asumimos que state puede ser RECHAZADO
      await tx.movimientoStock.update({
        where: { id: movimientoId },
        data: { 
          state: 'RECHAZADO',
          motivo: motivo ? `RECHAZADO: ${motivo}` : 'RECHAZADO'
        }
      });

      // 3. Devolver el stock a la tienda de origen
      // La tienda de origen es movimientoOriginal.tiendaId
      // El productoTiendaId es movimientoOriginal.productoTiendaId
      
      const productoTiendaOrigen = await tx.productoTienda.findUnique({
        where: { id: movimientoOriginal.productoTiendaId }
      });

      if (!productoTiendaOrigen) {
        throw new Error("Producto origen no encontrado");
      }

      const existenciaAnterior = productoTiendaOrigen.existencia;
      const cantidadRechazada = Math.abs(movimientoOriginal.cantidad);

      await tx.productoTienda.update({
        where: { id: productoTiendaOrigen.id },
        data: {
          existencia: {
            increment: cantidadRechazada
          }
        }
      });

      // 4. Crear un movimiento de entrada por devolución de rechazo
      await tx.movimientoStock.create({
        data: {
          tipo: MovimientoTipo.AJUSTE_ENTRADA, // O crear un tipo específico DEVOLUCION_RECHAZO si existe
          cantidad: cantidadRechazada,
          productoTiendaId: productoTiendaOrigen.id,
          tiendaId: movimientoOriginal.tiendaId,
          usuarioId: movimientoOriginal.usuarioId, // O el usuario que rechaza si se pasara
          existenciaAnterior: existenciaAnterior,
          motivo: `DEVOLUCIÓN POR RECHAZO: ${motivo || 'Sin motivo'}`,
          referenciaId: movimientoOriginal.id,
          costoUnitario: movimientoOriginal.costoUnitario,
          costoTotal: (movimientoOriginal.costoUnitario || 0) * cantidadRechazada,
        }
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("Error al rechazar movimiento:", error);
    return NextResponse.json(
      { error: "Error al procesar el rechazo", details: error.message },
      { status: 500 }
    );
  }
}
