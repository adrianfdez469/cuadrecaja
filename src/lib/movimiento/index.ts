import { prisma } from '../prisma';
import { isMovimientoBaja } from "@/utils/tipoMovimiento";

export const CreateMoviento = async (data, items) => {

  const { tipo, tiendaId, usuarioId, referenciaId, motivo, proveedorId } = data;

  await prisma.$transaction(async (tx) => {
    
    for (const movimiento of items) {
      const { productoId, cantidad, costoUnitario } = movimiento;

      // 1. Obtener el productoTienda existente para capturar la existencia anterior
      let existenciaAnterior = 0;
      const productoTiendaExistente = await tx.productoTienda.findFirst({
        where: {
          tiendaId,
          productoId,
          proveedorId: proveedorId || null
        },
      });

      let productoTienda;
      if (productoTiendaExistente) {
        existenciaAnterior = productoTiendaExistente.existencia;
        // 2. Update para obtener el productoTienda
        productoTienda = await tx.productoTienda.update({
          where: {
            id: productoTiendaExistente.id
          },
          data: {
            existencia: {
              increment: isMovimientoBaja(tipo) ? -cantidad : cantidad,
            },
            // Actualizar costo si es una compra
            ...(tipo === 'COMPRA' && costoUnitario && {
              costo: costoUnitario
            })
          },
        });

      } else {
        // 2. Create para obtener el productoTienda
        productoTienda = await tx.productoTienda.create({
          data: {
            tiendaId,
            productoId,
            costo: costoUnitario || 0,
            precio: 0,
            existencia: cantidad,
            proveedorId: proveedorId || null
          }
        })
      }

      // 3. Crear el movimiento con el ID del productoTienda y la existencia anterior
      await tx.movimientoStock.create({
        data: {
          tipo,
          cantidad,
          productoTiendaId: productoTienda.id,
          tiendaId,
          usuarioId,
          existenciaAnterior, // Guardar la existencia ANTES del movimiento
          ...(referenciaId && { referenciaId: referenciaId }),
          ...(motivo && { motivo: motivo }),
          ...(proveedorId && { proveedorId: proveedorId })
        },
      });
    }
  });

}