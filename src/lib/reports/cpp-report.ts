import { prisma } from '../prisma';

export interface CPPHistoryItem {
  id: string;
  fecha: Date;
  tipo: string;
  cantidad: number;
  costoUnitario: number | null;
  costoTotal: number | null;
  costoAnterior: number | null;
  costoNuevo: number | null;
  existenciaAnterior: number | null;
  motivo: string | null;
  usuario: {
    nombre: string;
  } | null;
  // 🆕 Indicadores para datos históricos
  esDatoHistorico: boolean;
  tieneDatosCPP: boolean;
}

export interface CPPAnalysis {
  productoId: string;
  productoNombre: string;
  costoActual: number;
  existenciaActual: number;
  valorInventarioActual: number;
  totalCompras: number;
  promedioCompras: number;
  ultimaCompra: Date | null;
  historial: CPPHistoryItem[];
  // 🆕 Estadísticas mejoradas
  comprasConCPP: number;
  comprasSinCPP: number;
  porcentajeConfiabilidad: number;
  ultimoCostoUnitario: number | null;
}

/**
 * Obtiene el historial completo de CPP para un producto específico
 * @param productoTiendaId - ID del producto en la tienda
 * @returns Historial de movimientos con cálculos de CPP
 */
export async function obtenerHistorialCPP(productoTiendaId: string): Promise<CPPHistoryItem[]> {
  const movimientos = await prisma.movimientoStock.findMany({
    where: {
      productoTiendaId,
      tipo: 'COMPRA'
    },
    include: {
      usuario: {
        select: {
          nombre: true
        }
      }
    },
    orderBy: {
      fecha: 'asc'
    }
  });

  return movimientos.map(mov => {
    const tieneDatosCPP = mov.costoUnitario !== null && mov.costoTotal !== null;
    const esDatoHistorico = mov.costoUnitario === null || mov.costoAnterior === null;
    
    return {
      id: mov.id,
      fecha: mov.fecha,
      tipo: mov.tipo,
      cantidad: mov.cantidad,
      costoUnitario: mov.costoUnitario,
      costoTotal: mov.costoTotal,
      costoAnterior: mov.costoAnterior,
      costoNuevo: mov.costoNuevo,
      existenciaAnterior: mov.existenciaAnterior,
      motivo: mov.motivo,
      usuario: mov.usuario,
      esDatoHistorico,
      tieneDatosCPP
    };
  });
}

/**
 * Genera un análisis completo de CPP para un producto
 * @param productoTiendaId - ID del producto en la tienda
 * @returns Análisis completo del CPP
 */
export async function analizarCPP(productoTiendaId: string): Promise<CPPAnalysis | null> {
  const productoTienda = await prisma.productoTienda.findUnique({
    where: {
      id: productoTiendaId
    },
    include: {
      producto: {
        select: {
          nombre: true
        }
      }
    }
  });

  if (!productoTienda) {
    return null;
  }

  const historial = await obtenerHistorialCPP(productoTiendaId);
  
  // 🆕 Separar compras con y sin datos CPP
  const comprasConCPP = historial.filter(h => h.tieneDatosCPP);
  const comprasSinCPP = historial.filter(h => !h.tieneDatosCPP);
  
  // 🆕 Calcular estadísticas solo con compras que tienen datos CPP válidos
  const totalCompras = comprasConCPP.reduce((sum, compra) => sum + (compra.costoTotal || 0), 0);
  const cantidadCompras = comprasConCPP.reduce((sum, compra) => sum + compra.cantidad, 0);
  const promedioCompras = cantidadCompras > 0 ? totalCompras / cantidadCompras : 0;
  
  // 🆕 Última compra válida (con datos CPP)
  const ultimaCompraValida = comprasConCPP.length > 0 ? comprasConCPP[comprasConCPP.length - 1].fecha : null;
  
  // 🆕 Ultimo costo unitario de compra
  const ultimoCostoUnitario = comprasConCPP.length > 0 ? comprasConCPP[comprasConCPP.length - 1].costoUnitario : null;
  
  // 🆕 Calcular porcentaje de confiabilidad
  const totalMovimientos = historial.length;
  const porcentajeConfiabilidad = totalMovimientos > 0 ? (comprasConCPP.length / totalMovimientos) * 100 : 0;

  return {
    productoId: productoTienda.productoId,
    productoNombre: productoTienda.producto.nombre,
    costoActual: productoTienda.costo,
    existenciaActual: productoTienda.existencia,
    valorInventarioActual: productoTienda.costo * productoTienda.existencia,
    totalCompras,
    promedioCompras,
    ultimaCompra: ultimaCompraValida,
    historial,
    comprasConCPP: comprasConCPP.length,
    comprasSinCPP: comprasSinCPP.length,
    porcentajeConfiabilidad,
    ultimoCostoUnitario
  };
}

/**
 * Obtiene análisis de CPP para todos los productos de una tienda
 * @param tiendaId - ID de la tienda
 * @returns Array de análisis de CPP
 */
export async function analizarCPPTienda(tiendaId: string): Promise<CPPAnalysis[]> {
  const productos = await prisma.productoTienda.findMany({
    where: {
      tiendaId,
      existencia: {
        gt: 0
      }
    },
    select: {
      id: true
    }
  });

  const analisis = await Promise.all(
    productos.map(p => analizarCPP(p.id))
  );

  return analisis.filter(a => a !== null) as CPPAnalysis[];
}

/**
 * Calcula diferencias entre costo actual y promedio de compras
 * @param tiendaId - ID de la tienda
 * @returns Productos con diferencias significativas en costos
 */
export async function detectarDesviacionesCPP(tiendaId: string, umbralPorcentaje: number = 10) {
  const analisis = await analizarCPPTienda(tiendaId);
  
  return analisis.filter(a => {
    // 🆕 Solo considerar productos con datos CPP confiables
    if (a.promedioCompras === 0 || a.porcentajeConfiabilidad < 50) return false;
    
    const diferenciaPorcentaje = Math.abs(a.costoActual - a.promedioCompras) / a.promedioCompras * 100;
    return diferenciaPorcentaje > umbralPorcentaje;
  }).map(a => ({
    ...a,
    diferenciaPorcentaje: Math.abs(a.costoActual - a.promedioCompras) / a.promedioCompras * 100,
    // diferenciaMonto: a.costoActual - a.promedioCompras
    diferenciaMonto: a.ultimoCostoUnitario - a.costoActual
  }));
}

/**
 * 🆕 Función para migrar datos históricos en producción
 * @param tiendaId - ID de la tienda
 * @param dryRun - Si es true, solo simula sin hacer cambios
 * @returns Reporte de la migración
 */
export async function migrarDatosHistoricosCPP(tiendaId: string, dryRun: boolean = true) {
  const movimientosSinCPP = await prisma.movimientoStock.findMany({
    where: {
      tiendaId,
      tipo: 'COMPRA',
      costoUnitario: null
    },
    include: {
      productoTienda: {
        include: {
          producto: {
            select: {
              nombre: true
            }
          }
        }
      }
    },
    orderBy: {
      fecha: 'asc'
    }
  });

  const reporte = {
    movimientosEncontrados: movimientosSinCPP.length,
    movimientosProcesados: 0,
    errores: 0,
    detalles: [] as string[]
  };

  if (dryRun) {
    reporte.detalles.push('🔍 SIMULACIÓN - No se realizarán cambios');
    reporte.detalles.push(`📋 Encontrados ${movimientosSinCPP.length} movimientos sin datos CPP`);
    
    movimientosSinCPP.forEach(mov => {
      reporte.detalles.push(
        `   - ${mov.productoTienda.producto.nombre} (${mov.fecha.toLocaleDateString()}) - ${mov.cantidad} unidades`
      );
    });
    
    return reporte;
  }

  // Procesar movimientos en producción
  for (const movimiento of movimientosSinCPP) {
    try {
      const costoActual = movimiento.productoTienda.costo || 0;
      
      await prisma.movimientoStock.update({
        where: {
          id: movimiento.id
        },
        data: {
          costoUnitario: 0, // Marcador de dato histórico
          costoTotal: 0,
          costoAnterior: costoActual,
          costoNuevo: costoActual
        }
      });

      reporte.movimientosProcesados++;
      reporte.detalles.push(
        `✅ ${movimiento.productoTienda.producto.nombre} - Procesado como histórico`
      );

    } catch (error) {
      reporte.errores++;
      reporte.detalles.push(
        `❌ ${movimiento.productoTienda.producto.nombre} - Error: ${error.message}`
      );
    }
  }

  return reporte;
} 