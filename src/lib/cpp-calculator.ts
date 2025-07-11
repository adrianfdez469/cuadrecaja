/**
 * Calculadora de Costo Promedio Ponderado (CPP)
 * Implementa la fórmula: CPP = (Valor Inventario Anterior + Costo Nueva Compra) / (Existencia Anterior + Cantidad Nueva Compra)
 */

import { ITipoMovimiento } from "@/types/IMovimiento";

export interface CPPCalculation {
  costoAnterior: number;
  costoNuevo: number;
  valorInventarioAnterior: number;
  valorInventarioNuevo: number;
  existenciaAnterior: number;
  existenciaNueva: number;
  cantidadCompra: number;
  costoUnitarioCompra: number;
  costoTotalCompra: number;
}

/**
 * Calcula el nuevo costo promedio ponderado después de una compra
 * @param existenciaAnterior - Cantidad en stock antes de la compra
 * @param costoAnterior - Costo promedio anterior
 * @param cantidadCompra - Cantidad de la nueva compra
 * @param costoUnitarioCompra - Costo unitario de la nueva compra
 * @returns Objeto con todos los cálculos del CPP
 */
export function calcularCPP(
  existenciaAnterior: number,
  costoAnterior: number,
  cantidadCompra: number,
  costoUnitarioCompra: number
): CPPCalculation {
  
  // Validaciones
  if (cantidadCompra <= 0) {
    throw new Error('La cantidad de compra debe ser mayor a 0');
  }
  
  if (costoUnitarioCompra <= 0) {
    throw new Error('El costo unitario debe ser mayor a 0');
  }
  
  if (existenciaAnterior < 0) {
    throw new Error('La existencia anterior no puede ser negativa');
  }
  
  if (costoAnterior < 0) {
    throw new Error('El costo anterior no puede ser negativo');
  }

  // Cálculos
  const costoTotalCompra = cantidadCompra * costoUnitarioCompra;
  const valorInventarioAnterior = existenciaAnterior * costoAnterior;
  const valorInventarioNuevo = valorInventarioAnterior + costoTotalCompra;
  const existenciaNueva = existenciaAnterior + cantidadCompra;
  
  // Fórmula CPP: (Valor Inventario Anterior + Costo Nueva Compra) / (Existencia Anterior + Cantidad Nueva Compra)
  const costoNuevo = existenciaNueva > 0 ? valorInventarioNuevo / existenciaNueva : 0;

  return {
    costoAnterior,
    costoNuevo,
    valorInventarioAnterior,
    valorInventarioNuevo,
    existenciaAnterior,
    existenciaNueva,
    cantidadCompra,
    costoUnitarioCompra,
    costoTotalCompra
  };
}

/**
 * Valida si un movimiento requiere cálculo de CPP
 * @param tipo - Tipo de movimiento
 * @returns true si requiere cálculo de CPP
 */
export function requiereCPP(tipo: ITipoMovimiento): boolean {
  return tipo === 'COMPRA' || tipo === 'TRASPASO_ENTRADA' || tipo === 'CONSIGNACION_ENTRADA';
}

/**
 * Formatea los resultados del CPP para logging
 * @param calculo - Resultado del cálculo CPP
 * @returns String formateado para logging
 */
export function formatearCPPLog(calculo: CPPCalculation): string {
  return `
📊 CÁLCULO CPP:
   Existencia anterior: ${calculo.existenciaAnterior} unidades
   Costo anterior: $${calculo.costoAnterior.toFixed(2)}
   Valor inventario anterior: $${calculo.valorInventarioAnterior.toFixed(2)}
   
   Nueva compra: ${calculo.cantidadCompra} unidades @ $${calculo.costoUnitarioCompra.toFixed(2)}
   Costo total compra: $${calculo.costoTotalCompra.toFixed(2)}
   
   Existencia nueva: ${calculo.existenciaNueva} unidades
   Valor inventario nuevo: $${calculo.valorInventarioNuevo.toFixed(2)}
   COSTO PROMEDIO PONDERADO: $${calculo.costoNuevo.toFixed(2)}
  `.trim();
} 