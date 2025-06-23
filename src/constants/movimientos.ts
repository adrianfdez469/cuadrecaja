import { ITipoMovimiento } from '@/types/IMovimiento';

// Todos los tipos de movimiento disponibles
export const TIPOS_MOVIMIENTO: ITipoMovimiento[] = [
  "COMPRA",
  "VENTA", 
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
  "DESAGREGACION_BAJA",
  "DESAGREGACION_ALTA"
];

// Tipos de movimiento que se pueden crear manualmente (excluye VENTA que se crea automáticamente)
export const TIPOS_MOVIMIENTO_MANUAL: ITipoMovimiento[] = [
  "COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
  "DESAGREGACION_BAJA",
  "DESAGREGACION_ALTA"
];

// Etiquetas para mostrar en la interfaz
export const TIPO_MOVIMIENTO_LABELS: Record<ITipoMovimiento, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE_ENTRADA: "Ajuste - Entrada",
  AJUSTE_SALIDA: "Ajuste - Salida", 
  TRASPASO_ENTRADA: "Traspaso - Entrada",
  TRASPASO_SALIDA: "Traspaso - Salida",
  DESAGREGACION_BAJA: "Desagregación - Baja",
  DESAGREGACION_ALTA: "Desagregación - Alta"
}; 