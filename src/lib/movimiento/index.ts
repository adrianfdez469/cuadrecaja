import { prisma } from '../prisma';
import { isMovimientoBaja } from "@/utils/tipoMovimiento";

export const CreateMoviento = async (data, items) => {

  const { tipo, tiendaId, usuarioId, referenciaId } = data;

    await prisma.$transaction(async (tx) => {
      for (const movimiento of items) {
        const {  productoId, cantidad } = movimiento;
  
        // 1. Obtener el productoTienda existente para capturar la existencia anterior
        let existenciaAnterior = 0;
        const productoTiendaExistente = await tx.productoTienda.findUnique({
          where: {
            tiendaId_productoId: {
              tiendaId,
              productoId,
            },
          },
        });

        if (productoTiendaExistente) {
          existenciaAnterior = productoTiendaExistente.existencia;
        }

        // 2. Upsert para obtener (o crear) el productoTienda
        const productoTienda = await tx.productoTienda.upsert({
          where: {
            tiendaId_productoId: {
              tiendaId,
              productoId,
            },
          },
          create: {
            tiendaId,
            productoId,
            costo: 0, // si tienes valores personalizados, agrégalos aquí
            precio: 0,
            existencia: cantidad,
          },
          update: {
            existencia: {
              increment: isMovimientoBaja(tipo) ? -cantidad : cantidad,
            },
          },
        });
  
        // 3. Crear el movimiento con el ID del productoTienda y la existencia anterior
        await tx.movimientoStock.create({
          data: {
            tipo,
            cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId,
            usuarioId,
            existenciaAnterior, // Guardar la existencia ANTES del movimiento
            ...(referenciaId && {referenciaId: referenciaId})
          },
        });
      }
    });

}