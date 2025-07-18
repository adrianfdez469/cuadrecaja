import { prisma } from '../prisma';
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { calcularCPP, requiereCPP, formatearCPPLog } from '../cpp-calculator';

export const CreateMoviento = async (data, items) => {

  const { tipo, tiendaId, usuarioId, referenciaId, motivo, proveedorId, destinationId } = data;

  console.log('data', data);
  

  await prisma.$transaction(async (tx) => {

    for (const movimiento of items) {
      const { productoId, cantidad, costoUnitario, proveedorId: itemProveedorId, movimientoOrigenId } = movimiento;
      console.log('movimiento', movimiento);
      

      // 1. Obtener el productoTienda existente para capturar la existencia anterior
      let existenciaAnterior = 0;
      const productoTiendaExistente = await tx.productoTienda.findFirst({
        where: {
          tiendaId,
          productoId,
          proveedorId: itemProveedorId || proveedorId || null
        },
      });

      let productoTienda;
      let calculoCPP = null;

      if (productoTiendaExistente) {
        existenciaAnterior = productoTiendaExistente.existencia;

        // 🆕 CÁLCULO CPP
        let nuevoCosto = productoTiendaExistente.costo;

        if (requiereCPP(tipo) && costoUnitario) {
          try {
            calculoCPP = calcularCPP(
              existenciaAnterior,
              productoTiendaExistente.costo,
              cantidad,
              costoUnitario
            );
            nuevoCosto = calculoCPP.costoNuevo;

            console.log('🔄 CPP CALCULADO:', formatearCPPLog(calculoCPP));
          } catch (error) {
            console.error('❌ Error calculando CPP:', error.message);
            // En caso de error, mantener el costo anterior
            nuevoCosto = productoTiendaExistente.costo;
          }
        }

        // 2. Update para obtener el productoTienda
        productoTienda = await tx.productoTienda.update({
          where: {
            id: productoTiendaExistente.id
          },
          data: {
            existencia: {
              ...(isMovimientoBaja(tipo) ? {decrement: cantidad} : {increment: cantidad}),
            },
            // 🆕 Actualizar con CPP calculado o costo directo
            ...(requiereCPP(tipo) && costoUnitario && {
              costo: nuevoCosto
            })
          },
        });

      } else {
        // 2. Create para obtener el productoTienda

        console.log(`Intentando crear productoTienda ${productoId} en tienda ${tiendaId} con proveedor ${itemProveedorId || proveedorId || null}`);
        

        productoTienda = await tx.productoTienda.create({
          data: {
            tiendaId,
            productoId,
            costo: costoUnitario || 0,
            precio: 0,
            existencia: cantidad,
            proveedorId: itemProveedorId || proveedorId || null
          }
        });

        // Para productos nuevos, registrar el cálculo inicial
        if (requiereCPP(tipo) && costoUnitario) {
          calculoCPP = {
            costoAnterior: 0,
            costoNuevo: costoUnitario,
            valorInventarioAnterior: 0,
            valorInventarioNuevo: cantidad * costoUnitario,
            existenciaAnterior: 0,
            existenciaNueva: cantidad,
            cantidadCompra: cantidad,
            costoUnitarioCompra: costoUnitario,
            costoTotalCompra: cantidad * costoUnitario
          };

          console.log('🆕 PRODUCTO NUEVO - CPP INICIAL:', formatearCPPLog(calculoCPP));
        }
      }

      // 3 Buscar productos fraccionables
      const productosFraccionados = await tx.producto.findMany({
        where: {
          fraccionDeId: productoId
        }
      });

      // 3.1 Actualizar los productos fraccionables
      for (const productoFraccion of productosFraccionados) {
        // 3.1.1 Buscar el productoTienda del producto fraccionado
        const productoTiendaFraccionado = await tx.productoTienda.findFirst({
          where: {
            productoId: productoFraccion.id,
            tiendaId
          }
        });
        if(calculoCPP){
          if (productoTiendaFraccionado) {
            // 3.1.2 Actualizar el productoTienda del producto fraccionado
            await tx.productoTienda.update({
              where: { id: productoTiendaFraccionado.id },
              data: { costo: calculoCPP.costoNuevo / productoFraccion.unidadesPorFraccion }
            });
          } else {
            // 3.1.3 Crear el productoTienda del producto fraccionado
            await tx.productoTienda.create({
              data: {
                productoId: productoFraccion.id,
                tiendaId,
                costo: calculoCPP.costoNuevo / productoFraccion.unidadesPorFraccion,
                precio: 0,
                existencia: 0,
                proveedorId: itemProveedorId || proveedorId || null,
              }
            });
          }
        }
      }

      // 4. Crear el movimiento con el ID del productoTienda y los datos de CPP
      await tx.movimientoStock.create({
        data: {
          tipo,
          cantidad,
          productoTiendaId: productoTienda.id,
          tiendaId,
          usuarioId,
          existenciaAnterior, // Guardar la existencia ANTES del movimiento

          // 🆕 CAMPOS CPP
          ...(calculoCPP && {
            costoUnitario: calculoCPP.costoUnitarioCompra,
            costoTotal: calculoCPP.costoTotalCompra,
            costoAnterior: calculoCPP.costoAnterior,
            costoNuevo: calculoCPP.costoNuevo
          }),

          ...(referenciaId && { referenciaId: referenciaId }),
          ...(motivo && { motivo: motivo }),
          ...(proveedorId && { proveedorId: proveedorId }),
          ...(itemProveedorId && {proveedorId: itemProveedorId}),
          ...(destinationId && { destinationId: destinationId }),
          ...(tipo === 'TRASPASO_SALIDA' && { state: 'PENDIENTE' })
        },
      });

      if(tipo === 'TRASPASO_ENTRADA'){
        await tx.movimientoStock.update({
          where: { id: movimientoOrigenId },
          data: { state: 'APROBADO' }
        });
      }
    }
  });

}
