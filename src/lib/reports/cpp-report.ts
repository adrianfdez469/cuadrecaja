import { prisma } from "@/lib/prisma";
import type { ITenantScope } from "@/lib/tenantScope";
import { withTenantScope } from "@/lib/tenantScope";
import { CPP_ENTRY_MOVEMENT_TYPES } from "@/constants/movimientos";

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

/** The report `migrarDatosHistoricosCPP` returns. Same shape it already built inline. */
export interface ICPPMigrationReport {
  movimientosEncontrados: number;
  movimientosProcesados: number;
  errores: number;
  detalles: string[];
}

/** One row of `detectarDesviacionesCPP`: the analysis plus its two deviation figures. */
export interface ICPPDeviation extends CPPAnalysis {
  diferenciaPorcentaje: number;
  diferenciaMonto: number;
}

/** PURE. `{ tiendaId, existencia: { gt: 0 }, tienda: { negocioId } }` */
export function cppProductosWhere(params: ITenantScope) {
  return withTenantScope(
    "productoTienda",
    { tiendaId: params.tiendaId, existencia: { gt: 0 } },
    params.negocioId,
  );
}

/** PURE. `{ tiendaId, tipo: { in: CPP_ENTRY_MOVEMENT_TYPES }, costoUnitario: null, tienda: { negocioId } }` */
export function cppMovimientosSinCostoWhere(params: ITenantScope) {
  return withTenantScope(
    "movimientoStock",
    {
      tiendaId: params.tiendaId,
      tipo: { in: CPP_ENTRY_MOVEMENT_TYPES },
      costoUnitario: null,
    },
    params.negocioId,
  );
}

/**
 * PURE. `{ id, tienda: { negocioId } }` — the guard on the ONLY write of this feature.
 * `update` takes no relation filter, so the write goes through `updateMany` (ADR 0085).
 */
export function cppMovimientoUpdateWhere(params: {
  negocioId: string;
  id: string;
}) {
  return withTenantScope("movimientoStock", { id: params.id }, params.negocioId);
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
      tipo: {
        in: CPP_ENTRY_MOVEMENT_TYPES
      }
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

// export async function analizarCPP(productoTiendaId: {}): Promise<CPPAnalysis | null> {
export async function analizarCPP(productoTienda: {id: string, costo: number, existencia: number, proveedor?: {nombre: string}, producto: {nombre: string}}): Promise<CPPAnalysis | null> {
  // const productoTienda = await prisma.productoTienda.findUnique({
  //   where: {
  //     id: productoTiendaData.id
  //   },
  //   include: {
  //     proveedor: true,
  //     producto: {
  //       select: {
  //         nombre: true,
          
  //       }
  //     }
  //   }
  // });

  if (!productoTienda) {
    return null;
  }

  const historial = await obtenerHistorialCPP(productoTienda.id);
  
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
    productoId: productoTienda.id,
    productoNombre: productoTienda.proveedor ? `${productoTienda.producto.nombre} - ${productoTienda.proveedor.nombre}` : productoTienda.producto.nombre,
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
 * @param params - Tenant scope: `negocioId` (applied to the query) and `tiendaId`
 * @returns Array de análisis de CPP
 */
export async function analizarCPPTienda(params: ITenantScope): Promise<CPPAnalysis[]> {
  const productos = await prisma.productoTienda.findMany({
    where: cppProductosWhere(params),
    select: {
      id: true,
      costo: true,
      existencia: true,
      proveedor: true,
      producto: true
    }
  });

  const analisis = await Promise.all(
    productos.map(p => analizarCPP({
      id: p.id,
      costo: p.costo,
      existencia: p.existencia,
      proveedor: p.proveedor,
      producto: p.producto
    }))
  );

  return analisis.filter(a => a !== null) as CPPAnalysis[];
}

/**
 * Calcula diferencias entre costo actual y promedio de compras
 * @param params - Tenant scope plus the optional `umbralPorcentaje` (defaults to 10)
 * @returns Productos con diferencias significativas en costos
 */
export async function detectarDesviacionesCPP(
  params: ITenantScope & { umbralPorcentaje?: number },
): Promise<ICPPDeviation[]> {
  const { negocioId, tiendaId, umbralPorcentaje = 10 } = params;
  const analisis = await analizarCPPTienda({ negocioId, tiendaId });

  return analisis
   .filter(a => {
    // 🆕 Solo considerar productos con datos CPP confiables
    if (a.promedioCompras === 0 || a.porcentajeConfiabilidad < 50) return false;
    
    // 🆕 Validar que ultimoCostoUnitario no sea null o 0 antes de calcular
    if (!a.ultimoCostoUnitario || a.ultimoCostoUnitario === 0) return false;
    
    const diferenciaPorcentaje = Math.abs(a.ultimoCostoUnitario - a.costoActual) / a.ultimoCostoUnitario * 100;
    return diferenciaPorcentaje > umbralPorcentaje;

  })
  .map(a => {
    // 🆕 Validar nuevamente en el map para evitar errores
    if (!a.ultimoCostoUnitario || a.ultimoCostoUnitario === 0) {
      return {
        ...a,
        diferenciaPorcentaje: 0,
        diferenciaMonto: 0
      };
    }
    
    return {
      ...a,
      diferenciaPorcentaje: Math.abs(a.ultimoCostoUnitario - a.costoActual) / a.ultimoCostoUnitario * 100,
      diferenciaMonto: a.ultimoCostoUnitario - a.costoActual
    };
  });
}

/**
 * 🆕 Función para migrar datos históricos en producción
 * @param params - Tenant scope plus the optional `dryRun` (defaults to true)
 * @returns Reporte de la migración
 */
export async function migrarDatosHistoricosCPP(
  params: ITenantScope & { dryRun?: boolean },
): Promise<ICPPMigrationReport> {
  const { negocioId, tiendaId, dryRun = true } = params;
  const movimientosSinCPP = await prisma.movimientoStock.findMany({
    where: cppMovimientosSinCostoWhere({ negocioId, tiendaId }),
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

  const reporte: ICPPMigrationReport = {
    movimientosEncontrados: movimientosSinCPP.length,
    movimientosProcesados: 0,
    errores: 0,
    detalles: []
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
      
      const { count } = await prisma.movimientoStock.updateMany({
        where: cppMovimientoUpdateWhere({ negocioId, id: movimiento.id }),
        data: {
          costoUnitario: 0, // Marcador de dato histórico
          costoTotal: 0,
          costoAnterior: costoActual,
          costoNuevo: costoActual
        }
      });

      if (count === 1) {
        reporte.movimientosProcesados++;
        reporte.detalles.push(
          `✅ ${movimiento.productoTienda.producto.nombre} - Procesado como histórico`
        );
      } else {
        reporte.errores++;
        reporte.detalles.push(
          `❌ ${movimiento.productoTienda.producto.nombre} - No se pudo actualizar`
        );
      }

    } catch (error) {
      console.error(error);
      reporte.errores++;
      reporte.detalles.push(
        `❌ ${movimiento.productoTienda.producto.nombre} - Error: ${error.message}`
      );
    }
  }

  return reporte;
} 