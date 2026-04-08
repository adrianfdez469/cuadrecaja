import { prisma } from '../prisma';
import {Prisma, PrismaClient} from "@prisma/client";
import PrismaClientOptions = Prisma.PrismaClientOptions;
import {DefaultArgs} from "@prisma/client/runtime/binary";


interface IImportarItemsMov {
    nombreProducto: string;
    costo: number;
    precio: number;
    cantidad: number;
    esConsignación?: boolean;
    nombreProveedor?: string;
    categoria: string;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any[]; // Agregar propiedad data para los resultados
  }
  
  // Función para sanitizar strings
  const sanitizarString = (str: string, maxLength: number = 255): string => {
    if (!str || typeof str !== 'string') return '';
    
    // Remover caracteres de control y espacios extra
    const sanitizado = str
      .trim()
      .replace(/[\x00-\x1F\x7F]/g, '') // Remover caracteres de control
      .replace(/\s+/g, ' ') // Normalizar espacios múltiples
      .substring(0, maxLength); // Limitar longitud
      
    return sanitizado;
  };
  
  // Función para validar y sanitizar un item
  const validarYSanitizarItem = (item: IImportarItemsMov): { 
    itemSanitizado?: IImportarItemsMov, 
    errores: string[] 
  } => {
    const errores = [];
  
    // Validar nombreProducto
    if (!item.nombreProducto || typeof item.nombreProducto !== 'string') {
      errores.push("nombreProducto es requerido y debe ser una cadena de texto");
    } else {
      const nombreSanitizado = sanitizarString(item.nombreProducto, 255);
      if (nombreSanitizado.length === 0) {
        errores.push("nombreProducto no puede estar vacío después de la sanitización");
      } else if (nombreSanitizado.length < 2) {
        errores.push("nombreProducto debe tener al menos 2 caracteres");
      }
    }
  
    // Validar valores numéricos
    if (typeof item.costo !== 'number' || isNaN(item.costo) || !isFinite(item.costo)) {
      errores.push("costo debe ser un número válido");
    } else if (item.costo < 0) {
      errores.push("costo no puede ser negativo");
    } else if (item.costo > 999999999.99) {
      errores.push("costo excede el límite máximo permitido");
    }
  
    if (typeof item.precio !== 'number' || isNaN(item.precio) || !isFinite(item.precio)) {
      errores.push("precio debe ser un número válido");
    } else if (item.precio < 0) {
      errores.push("precio no puede ser negativo");
    } else if (item.precio > 999999999.99) {
      errores.push("precio excede el límite máximo permitido");
    }
  
    if (typeof item.cantidad !== 'number' || isNaN(item.cantidad) || !isFinite(item.cantidad)) {
      errores.push("cantidad debe ser un número válido");
    } else if (item.cantidad > 999999) {
      errores.push("cantidad excede el límite máximo permitido");
    }
  
    // Validar nombreProveedor si es consignación
    if (item.esConsignación) {
      if (item.nombreProveedor) {
        const proveedorSanitizado = sanitizarString(item.nombreProveedor, 255);
        if (proveedorSanitizado.length === 0) {
          errores.push("nombreProveedor no puede estar vacío cuando esConsignación es true");
        } else if (proveedorSanitizado.length < 2) {
          errores.push("nombreProveedor debe tener al menos 2 caracteres");
        }
      }
    }
  
    if (errores.length > 0) {
      return { errores };
    }
  
    // Retornar item sanitizado
    return {
      itemSanitizado: {
        ...item,
        nombreProducto: sanitizarString(item.nombreProducto, 255),
        nombreProveedor: item.nombreProveedor ? sanitizarString(item.nombreProveedor, 255) : undefined,
        costo: Number(item.costo),
        precio: Number(item.precio),
        cantidad: Number(item.cantidad)
      },
      errores: []
    };
  };
  
  // Función para dividir array en chunks
  const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  };
  
  // Función para procesar lotes grandes en chunks
  const procesarLotesGrandes = async (
    data: IImportData,
    items: IImportarItemsMov[],
    chunkSize: number = 50
  ): Promise<IImportarResponse> => {
    console.log(`📦 Procesando ${items.length} items en chunks de ${chunkSize}`);
    
    const chunks = chunkArray(items, chunkSize);
    const resultadosTotales = [];
    const erroresTotales = [];
  
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔄 Procesando chunk ${i + 1}/${chunks.length} con ${chunk.length} items`);
      
      try {
        const resultado = await procesarChunk(data, chunk);
        if (resultado.success) {
          resultadosTotales.push(...resultado.data || []);
        } else {
          erroresTotales.push({
            chunk: i + 1,
            error: resultado.message,
            causa: resultado.errorCause
          });
        }
      } catch (error) {
        console.log(`💥 Error procesando chunk ${i + 1}:`, error);
        erroresTotales.push({
          chunk: i + 1,
          error: error.message || 'Error desconocido',
          causa: error.cause || null
        });
      }
    }
  
    if (erroresTotales.length > 0) {
      return {
        success: false,
        message: `Error al procesar ${erroresTotales.length} de ${chunks.length} chunks`,
        errorCause: erroresTotales.map(err => 
          `Chunk ${err.chunk}: ${err.error} (${err.causa ? `Causa: ${err.causa}` : ''})`
        ).join('; ')
      };
    }
  
    return {
      success: true,
      message: `Importación completada: ${resultadosTotales.length} productos procesados en ${chunks.length} chunks`,
      data: resultadosTotales
    };
  };
  
  // Función para procesar un chunk individual
  const procesarChunk = async (
    data: IImportData,
    items: IImportarItemsMov[]
  ): Promise<IImportarResponse> => {
    
    return prisma.$transaction(async (tx) => {
      

      const proveedoresMap = new Map();
      const resultados = [];

      for (const item of items) {
        const nombreCategoria = item.categoria || "SIN CATEGORIA";
        
        const categoriaId = await getCategoryId(nombreCategoria, data.negocioId, tx);
        
        // Verificar si el producto ya existe
        let producto = await tx.producto.findFirst({
          where: {
            nombre: item.nombreProducto,
            negocioId: data.negocioId
          }
        });
        if (!producto) {
          // Si no existe, lo creo
          producto = await tx.producto.create({
            data: {
              nombre: item.nombreProducto,
              descripcion: "",
              categoriaId: categoriaId,
              negocioId: data.negocioId
            }
          });
        }

        // Manejar proveedor si es consignación
        let proveedorId = "";
        if (item.nombreProveedor) {
          const nombreProveedorFinal = item.nombreProveedor;

          if (proveedoresMap.has(nombreProveedorFinal)) {
            proveedorId = proveedoresMap.get(nombreProveedorFinal)!;
          } else {
            const proveedor = await tx.proveedor.findFirst({
              where: {
                nombre: nombreProveedorFinal,
                negocioId: data.negocioId
              }
            });

            if (proveedor) {
              proveedorId = proveedor.id;
            } else {
              const newProveedor = await tx.proveedor.create({
                data: {
                  nombre: nombreProveedorFinal,
                  negocioId: data.negocioId,
                }
              });
              proveedorId = newProveedor.id;
            }
            proveedoresMap.set(nombreProveedorFinal, proveedorId);
          }
        }

        // Crear productoTienda
        const productoTienda = await tx.productoTienda.create({
          data: {
            productoId: producto.id,
            costo: item.costo,
            existencia: item.cantidad,
            precio: item.precio,
            tiendaId: data.localId,
            ...(proveedorId && {proveedorId: proveedorId})
          }
        });

        // Crear movimiento
        await tx.movimientoStock.create({
          data: {
            tipo: item.esConsignación ? 'CONSIGNACION_ENTRADA' : 'COMPRA',
            cantidad: item.cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId: data.localId,
            usuarioId: data.usuarioId,
            existenciaAnterior: 0,
            costoUnitario: item.costo,
            costoTotal: item.costo * item.cantidad,
            costoAnterior: 0,
            costoNuevo: item.costo,
            ...(proveedorId && {proveedorId: proveedorId})
          },
        });

        resultados.push({
          nombreProducto: item.nombreProducto,
          success: true
        });
      }

      return {
        success: true,
        message: `Chunk procesado: ${resultados.length} productos`,
        data: resultados
      };
    });
  };
  
  export const ImportarExcelMovimiento = async (data: IImportData, items: IImportarItemsMov[]): Promise<IImportarResponse> => {
    const startTime = Date.now();
    console.log(`🚀 Iniciando importación de ${items?.length || 0} productos para negocio ${data?.negocioId}`);
    
    try {
      // Validación de datos de entrada
      if (!data || !items || !Array.isArray(items) || items.length === 0) {
        console.log('❌ Validación fallida: datos de entrada inválidos');
        return {
          success: false,
          message: "Datos de entrada inválidos",
          errorCause: "El array de items está vacío o es inválido"
        };
      }
  
      // Validación de datos requeridos
      if (!data.negocioId || !data.localId || !data.usuarioId) {
        console.log('❌ Validación fallida: datos requeridos faltantes', { data });
        return {
          success: false,
          message: "Datos requeridos faltantes",
          errorCause: "negocioId, localId y usuarioId son obligatorios"
        };
      }
  
      console.log('✅ Validaciones básicas pasadas');
  
      // Validación y sanitización de items individuales
      const itemsInvalidos = [];
      const itemsSanitizados = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const validacion = validarYSanitizarItem(item);
        
        if (validacion.errores.length > 0) {
          itemsInvalidos.push({
            indice: i,
            nombreProducto: item.nombreProducto || 'N/A',
            errores: validacion.errores
          });
        } else {
          itemsSanitizados.push(validacion.itemSanitizado!);
        }
      }
  
      if (itemsInvalidos.length > 0) {
        console.log('❌ Items con datos inválidos encontrados:', itemsInvalidos);
        return {
          success: false,
          message: "Items con datos inválidos encontrados",
          errorCause: `Items inválidos: ${itemsInvalidos.map(item => 
            `Fila ${item.indice + 1} (${item.nombreProducto}): ${item.errores.join(', ')}`
          ).join('; ')}`
        };
      }
  
      console.log('✅ Validación y sanitización de items completada');
  
      console.log('🔍 Buscando negocio...');
      const negocio = await prisma.negocio.findUnique({
        where: {
          id: data.negocioId
        },
        include: {
          tiendas: true,
          plan: { select: { limiteProductos: true } }
        }
      })
    
      if (!negocio) {
        console.log('❌ Negocio no encontrado:', data.negocioId);
        throw new Error("NEGOCIO_NO_ENCONTRADO", {cause: data.negocioId});
      }
  
      console.log('✅ Negocio encontrado:', negocio.nombre);
  
      // Validar que la tienda pertenezca al negocio
      const tiendaPerteneceAlNegocio = negocio.tiendas.some(tienda => tienda.id === data.localId);
      if (!tiendaPerteneceAlNegocio) {
        console.log('❌ Tienda no pertenece al negocio:', { tiendaId: data.localId, negocioId: data.negocioId });
        return {
          success: false,
          message: "Tienda no pertenece al negocio",
          errorCause: `La tienda ${data.localId} no pertenece al negocio ${data.negocioId}`
        };
      }
  
      console.log('✅ Validación de tienda completada');
  
      const productLimit = negocio.plan?.limiteProductos ?? -1;

      if (productLimit !== -1 && productLimit <= itemsSanitizados.length) {
        console.log('❌ Límite de productos excedido:', { limite: productLimit, cantidad: itemsSanitizados.length });
        throw new Error("LIMITE_DE_PRODUCTOS_EXCEDIDO", {cause: productLimit});
      }
    
      // Verificar productos duplicados en el lote
      const claves = itemsSanitizados.map(
        item => `${item.nombreProducto}|||${item.nombreProveedor || ""}`
      );
      const clavesDuplicadas = claves.filter((clave, idx) => claves.indexOf(clave) !== idx);
      if (clavesDuplicadas.length > 0) {
        console.log('❌ Productos duplicados encontrados:', clavesDuplicadas);
        return {
          success: false,
          message: "Productos duplicados en el lote (producto + proveedor)",
          errorCause: `Duplicados: ${[...new Set(clavesDuplicadas)].join(', ')}`
        };
      }
  
      console.log('✅ Sanitización y validación de duplicados completada');
  
      // Decidir si usar procesamiento por chunks o transacción única
      const CHUNK_THRESHOLD = 100; // Umbral para usar chunks
      const CHUNK_SIZE = 50; // Tamaño de cada chunk
  
      if (itemsSanitizados.length > CHUNK_THRESHOLD) {
        console.log(`📦 Lote grande detectado (${itemsSanitizados.length} items), usando procesamiento por chunks`);
        return await procesarLotesGrandes(data, itemsSanitizados, CHUNK_SIZE);
      }
  
      // Procesamiento normal para lotes pequeños
      await prisma.$transaction(async (tx) => {
        console.log('🔄 Iniciando transacción de base de datos...');
    
        // Crear un mapa de proveedores para evitar duplicados
        const proveedoresMap = new Map();
    
        const { resultados, errores } = await procesarLoteProductos(
          tx,
          itemsSanitizados,
          data,
          proveedoresMap
        );
  
        if (errores.length > 0) {
          console.log('❌ Errores durante el procesamiento:', errores);
          throw new Error("ERRORES_EN_PROCESAMIENTO", { 
            cause: errores.map(err => 
              `Fila ${err.indice + 1} (${err.nombreProducto}): ${err.error} (${err.causa ? `Causa: ${err.causa}` : ''})`
            ).join('; ')
          });
        }
  
        console.log(`✅ Procesamiento completado: ${resultados.length} productos importados exitosamente`);
      });
  
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`🎉 Importación completada en ${duration}ms`);
  
      return {
        success: true,
        message: "Movimientos importados correctamente"
      }
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`💥 Error en importación después de ${duration}ms:`, error);
  
      // Manejo mejorado de errores específicos de Prisma
      if (error.code === 'P2002') {
        return {
          success: false,
          message: "Error de duplicación en base de datos",
          errorCause: "Ya existe un registro con los mismos datos únicos"
        };
      }
      
      if (error.code === 'P2003') {
        return {
          success: false,
          message: "Error de referencia en base de datos",
          errorCause: "Se intentó crear una referencia a un registro que no existe"
        };
      }
  
      if (error.code === 'P2025') {
        return {
          success: false,
          message: "Registro no encontrado",
          errorCause: "El registro solicitado no existe en la base de datos"
        };
      }
  
      if (error.code === 'P2034') {
        return {
          success: false,
          message: "Error de transacción",
          errorCause: "La transacción falló debido a un conflicto de concurrencia"
        };
      }
  
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
        case "ERRORES_EN_PROCESAMIENTO":
          return {
            success: false,
            message: "Error al importar algunos productos",
            errorCause: error.cause
          }
        default:
          return {
            success: false,
            message: "Error al importar productos",
            errorCause: error.message || "Error desconocido"
          }
      }
    }
  
    
  }
  
  // Función auxiliar para procesar lotes pequeños (versión simplificada)
  const procesarLoteProductos = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    items: IImportarItemsMov[],
    data: IImportData,
    proveedoresMap: Map<string, string>
  ) => {
    const resultados = [];
    const errores = [];
  
    console.log('🔍 Procesando productos...');
  
    // 1. Crear o buscar todos los productos únicos por nombre
    const productosUnicos = Array.from(
      new Set(items.map(item => item.nombreProducto))
    );
    const productosMap = new Map();
  
    for (const nombreProducto of productosUnicos) {
      const nombreCategoria = items.find(p => p.nombreProducto === nombreProducto)?.categoria || "SIN CATEGORIA";
      const categoriaId = await getCategoryId(nombreCategoria, data.negocioId, tx);
      let producto = await tx.producto.findFirst({
        where: {
          nombre: nombreProducto,
          negocioId: data.negocioId
        }
      });
      if (!producto) {
        producto = await tx.producto.create({
          data: {
            nombre: nombreProducto,
            descripcion: "",
            categoriaId: categoriaId,
            negocioId: data.negocioId
          }
        });
      }
      productosMap.set(nombreProducto, producto);
    }
  
    // 2. Procesar cada fila (productoTienda y movimiento)
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        const producto = productosMap.get(item.nombreProducto);
  
        // Proveedor
        let proveedorId = null;
  
        console.log('🔍 Procesando producto:', item.nombreProducto);
        console.log('🔍 Proveedor:', item.nombreProveedor);
  
        if (item.nombreProveedor) {
          const nombreProveedorFinal = item.nombreProveedor;
          if (proveedoresMap.has(nombreProveedorFinal)) {
            proveedorId = proveedoresMap.get(nombreProveedorFinal)!;
          } else {
            let proveedor = await tx.proveedor.findFirst({
              where: {
                nombre: nombreProveedorFinal,
                negocioId: data.negocioId
              }
            });
            if (!proveedor) {
              proveedor = await tx.proveedor.create({
                data: {
                  nombre: nombreProveedorFinal,
                  negocioId: data.negocioId,
                }
              });
            }
            proveedorId = proveedor.id;
            proveedoresMap.set(nombreProveedorFinal, proveedorId);
          }
        }
  
        console.log('🔍 Procesando productoProveedorID', proveedorId);
  
        // Verificar si ya existe productoTienda para ese producto, tienda y proveedor
        const existeProductoTienda = await tx.productoTienda.findFirst({
          where: {
            productoId: producto.id,
            tiendaId: data.localId,
            proveedorId: proveedorId || null
          }
        });
        if (existeProductoTienda) {
          errores.push({
            indice: i,
            nombreProducto: item.nombreProducto,
            error: "Ya existe productoTienda para este producto y proveedor en la tienda",
            causa: existeProductoTienda.id
          });
          continue;
        }
  
        // Crear productoTienda
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
  
        // Crear movimiento
        await tx.movimientoStock.create({
          data: {
            tipo: 'COMPRA',
            cantidad: item.cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId: data.localId,
            usuarioId: data.usuarioId,
            existenciaAnterior: 0,
            costoUnitario: item.costo,
            costoTotal: item.costo * item.cantidad,
            costoAnterior: 0,
            costoNuevo: item.costo,
            ...(proveedorId && { proveedorId: proveedorId })
          },
        });
  
        resultados.push({
          indice: i,
          nombreProducto: item.nombreProducto,
          success: true
        });
  
      } catch (error) {
        errores.push({
          indice: i,
          nombreProducto: items[i]?.nombreProducto || 'N/A',
          error: error.message || 'Error desconocido',
          causa: error.cause || null
        });
      }
    }
  
    return { resultados, errores };
  };


  const getCategoryId = async (categoryName: string, negocioId: string, tx: Omit<PrismaClient<PrismaClientOptions, never, DefaultArgs>, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) => {
    const nombreCategoria = categoryName || "SIN CATEGORIA";

    // Buscar o crear categoría
    let categoriaId = "";
    const categoria = await tx.categoria.findFirst({
      where: {
        nombre: nombreCategoria,
        negocioId: negocioId
      }
    });

    if (!categoria) {
      const newCategoria = await tx.categoria.create({
        data: {
          nombre: nombreCategoria,
          negocioId: negocioId,
          color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`
        }
      });
      categoriaId = newCategoria.id;
    } else {
      categoriaId = categoria.id;
    }

    return categoriaId;
  }


  