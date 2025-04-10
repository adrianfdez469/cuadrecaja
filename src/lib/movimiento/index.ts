import { prisma } from '../prisma';
import { isMovimientoBaja } from "@/utils/tipoMovimiento";

export const CreateMoviento = async (data, items) => {

  const { tipo, tiendaId, usuarioId } = data;

    await prisma.$transaction(async (tx) => {
      for (const movimiento of items) {
        const {  productoId, cantidad } = movimiento;
  
        // 1. Upsert para obtener (o crear) el productoTienda
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
  
        // 2. Crear el movimiento con el ID del productoTienda
        await tx.movimientoStock.create({
          data: {
            tipo,
            cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId,
            usuarioId,
          },
        });
      }
    });

}