import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Elimina un negocio y todas sus entidades relacionadas (orden respetando FKs).
 * Uso administrativo / mantenimiento (p. ej. purga de cuentas de prueba).
 */
export async function deleteNegocioCompleto(negocioId: string): Promise<void> {
  const negocioWhere: Prisma.NegocioWhereUniqueInput = { id: negocioId };

  await prisma.$transaction(async (tx) => {
    await tx.appliedDiscount.deleteMany({
      where: { venta: { tienda: { negocioId } } },
    });

    await tx.venta.deleteMany({
      where: { tienda: { negocioId } },
    });

    await tx.movimientoStock.deleteMany({
      where: {
        OR: [
          { tienda: { negocioId } },
          { destination: { negocioId } },
          { productoTienda: { tienda: { negocioId } } },
        ],
      },
    });

    await tx.productoProveedorLiquidacion.deleteMany({
      where: { cierre: { tienda: { negocioId } } },
    });

    await tx.gastoCierre.deleteMany({
      where: { cierre: { tienda: { negocioId } } },
    });

    await tx.cierrePeriodo.deleteMany({
      where: { tienda: { negocioId } },
    });

    await tx.transferDestinations.deleteMany({
      where: { tienda: { negocioId } },
    });

    await tx.gastoTienda.deleteMany({ where: { negocioId } });
    await tx.gastoPlantilla.deleteMany({ where: { negocioId } });

    await tx.usuarioTienda.deleteMany({
      where: {
        OR: [{ usuario: { negocioId } }, { tienda: { negocioId } }],
      },
    });

    await tx.discountRule.deleteMany({ where: { negocioId } });

    await tx.productoTienda.deleteMany({
      where: { tienda: { negocioId } },
    });

    await tx.codigoProducto.deleteMany({
      where: { producto: { negocioId } },
    });

    for (let i = 0; i < 50; i++) {
      const deleted = await tx.producto.deleteMany({
        where: { negocioId, fraccionDeId: { not: null } },
      });
      if (deleted.count === 0) break;
    }

    await tx.producto.deleteMany({ where: { negocioId } });

    await tx.categoria.deleteMany({ where: { negocioId } });

    await tx.proveedor.deleteMany({ where: { negocioId } });

    await tx.rol.deleteMany({ where: { negocioId } });

    await tx.usuario.updateMany({
      where: { negocioId },
      data: { localActualId: null },
    });

    await tx.usuario.deleteMany({ where: { negocioId } });

    await tx.tienda.deleteMany({ where: { negocioId } });

    await tx.negocio.delete({ where: negocioWhere });
  });
}
