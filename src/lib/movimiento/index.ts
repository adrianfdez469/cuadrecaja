import { prisma } from '../prisma';
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { calcularCPP, requiereCPP, formatearCPPLog } from '../cpp-calculator';

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
      let calculoCPP = null;

      if (productoTiendaExistente) {
        existenciaAnterior = productoTiendaExistente.existencia;

        // 🆕 CÁLCULO CPP PARA COMPRAS
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
              increment: isMovimientoBaja(tipo) ? -cantidad : cantidad,
            },
            // 🆕 Actualizar con CPP calculado o costo directo
            ...(requiereCPP(tipo) && costoUnitario && {
              costo: nuevoCosto
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
        if (productoTiendaFraccionado) {
          // 3.1.2 Actualizar el productoTienda del producto fraccionado
          await tx.productoTienda.update({
            where: { id: productoFraccion.id },
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
              proveedorId: proveedorId || null,
            }
          });
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
          ...(proveedorId && { proveedorId: proveedorId })
        },
      });
    }
  });

}

interface IImportarItemsMov {
  nombreProducto: string;
  costo: number;
  precio: number;
  cantidad: number;
  esConsignación?: boolean;
  nombreProveedor?: string;
}

interface IImportData {
  usuarioId: string;
  negocioId: string;
  localId: string;
}

interface IImportarResponse {
  success: boolean;
  message: string;
  
  errorCause?: string;
  
}

export const ImportarExcelMovimiento = async (data: IImportData, items: IImportarItemsMov[]): Promise<IImportarResponse> => {
  try {

    const nombreCategoría = "SIN CATEGORIA";
    const nombreProveedor = "PROVEEDOR";

    if(!data.negocioId || !data.localId || !data.usuarioId) {
      throw new Error("DATOS_INCOMPLETOS");
    }

    if(!items || items.length === 0) {
      throw new Error("ITEMS_INCOMPLETOS");
    }
  
    const negocio = await prisma.negocio.findUnique({
      where: {
        id: data.negocioId
      },
      include: {
        tiendas: true
      }
    })
  
    if (!negocio) {
      throw new Error("NEGOCIO_NO_ENCONTRADO", {cause: data.negocioId});
    }
    const productLimit = negocio.productlimit;
  
    if (productLimit !== -1 && productLimit <= items.length) {
      throw new Error("LIMITE_DE_PRODUCTOS_EXCEDIDO", {cause: productLimit});
    }
  
    await prisma.$transaction(async (tx) => {
  
      // Paso 0: Crear o buscar categoría
      let categoriaId = "";
      const categoría = await tx.categoria.findFirst({
        where: {
          nombre: nombreCategoría,
          negocioId: data.negocioId
        }
      })
      if (!categoría) {
        const newCategoria = await tx.categoria.create({
          data: {
            nombre: nombreCategoría,
            negocioId: data.negocioId,
            color: "000000"
          }
        });
        categoriaId = newCategoria.id;
      } else {
        categoriaId = categoría.id;
      }
  
      for (const item of items) {
        // Paso 1: Buscar producto por nombre
        let producto = await tx.producto.findFirst({
          where: {
            nombre: item.nombreProducto.trim(),
            negocioId: data.negocioId
          }
        });
        // Paso 1.1 Si existe abortar y enviar mensaje informativo
        if (producto) {
          throw new Error("PRODUCTO_EXISTE", { cause: producto.id });
        }
        // Paso 1.2 Si no existe creo el producto y obtengo su ID
        producto = await tx.producto.create({
          data: {
            nombre: item.nombreProducto.trim(),
            descripcion: "",
            categoriaId: categoriaId,
            negocioId: data.negocioId
          }
        });
  
  
        let proveedorId = "";
        if (item.esConsignación) {
          // Revisa si existe el proveedor
          const proveedor = await tx.proveedor.findFirst({
            where: {
              nombre: item.nombreProveedor ? item.nombreProveedor.trim() : nombreProveedor,
              negocioId: data.negocioId
            }
          });
          if (proveedor) {
            // Si existe obten el id
            proveedorId = proveedor.id;
          } else {
            // Si no existe crealo y obten el id
            const newProveedor = await tx.proveedor.create({
              data: {
                nombre: item.nombreProveedor ? item.nombreProveedor.trim() : nombreProveedor,
                negocioId: data.negocioId,
              }
            });
            proveedorId = newProveedor.id;
          }
  
        }
  
        // Paso 3: Crear productoTienda
        const productoTienda = await tx.productoTienda.create({
          data: {
            productoId: producto.id,
            costo: item.costo,
            existencia: item.cantidad,
            precio: item.precio,
            tiendaId: data.localId,
            ...(proveedorId && { proveedorId: proveedorId })
          }
        });
  
        // Paso 4: Crear movimientos COMPRA | CONSIGNACION_ENTRADA
        await tx.movimientoStock.create({
          data: {
            tipo: item.esConsignación ? 'CONSIGNACION_ENTRADA' : 'COMPRA',
            cantidad: item.cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId: data.localId,
            usuarioId: data.usuarioId,
            existenciaAnterior: 0,
            // 🆕 CAMPOS CPP
            costoUnitario: item.costo,
            costoTotal: item.costo * item.cantidad,
            costoAnterior: 0,
            costoNuevo: item.costo,
  
            ...(proveedorId && { proveedorId: proveedorId })
          },
        });
  
      }
    });

    return {
      success: true,
      message: "Movimientos importados correctamente"
    }
  } catch (error) {
    switch (error.message) {
      case "NEGOCIO_NO_ENCONTRADO":
        return {
          success: false,
          message: "Negocio no encontrado",
          errorCause: `Id del negocio: ${error.cause}`
        }
      case "LIMITE_DE_PRODUCTOS_EXCEDIDO":
        return {
          success: false,
          message: "Limite de productos excedido",
          errorCause: `Limite actual del negocio: ${error.cause}`
        }
      case "PRODUCTO_EXISTE":
        return {
          success: false,
          message: "Producto ya existe",
          errorCause: `Id del producto: ${error.cause}`
        }
      case "DATOS_INCOMPLETOS":
        return {
          success: false,
          message: "Datos incompletos",
          errorCause: error.message
        } 
      case "ITEMS_INCOMPLETOS":
        return {
          success: false,
          message: "Items incompletos",
          errorCause: error.message
        }
      default:
        return {
          success: false,
          message: "Error al importar productos",
          errorCause: error.message
        }
    }
  }

  
}
