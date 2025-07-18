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
  "DESAGREGACION_ALTA",
  "CONSIGNACION_ENTRADA",
  "CONSIGNACION_DEVOLUCION"
];

// Tipos de movimiento que se pueden crear manualmente (excluye VENTA que se crea automáticamente)
export const TIPOS_MOVIMIENTO_MANUAL: ITipoMovimiento[] = [
  "COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
  // "TRASPASO_ENTRADA",
  "TRASPASO_SALIDA",
  //"DESAGREGACION_BAJA",
  //"DESAGREGACION_ALTA",
  "CONSIGNACION_ENTRADA",
  "CONSIGNACION_DEVOLUCION"
];

// Etiquetas para mostrar en la interfaz
export const TIPO_MOVIMIENTO_LABELS: Record<ITipoMovimiento, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE_ENTRADA: "Ajuste - Entrada",
  AJUSTE_SALIDA: "Ajuste - Salida", 
  TRASPASO_ENTRADA: "Recepción de mercancía",
  TRASPASO_SALIDA: "Envío de mercancía",
  DESAGREGACION_BAJA: "Desagregación - Baja",
  DESAGREGACION_ALTA: "Desagregación - Alta",
  CONSIGNACION_ENTRADA: "Consignación - Entrada",
  CONSIGNACION_DEVOLUCION: "Consignación - Devolución"
};

// Descripciones informativas para cada tipo de movimiento
export const TIPO_MOVIMIENTO_DESCRIPTIONS: Record<ITipoMovimiento, string> = {
  COMPRA: "Registra la compra de productos. Aumenta el inventario y permite establecer costos unitarios.",
  VENTA: "Registra automáticamente las ventas de productos. Disminuye el inventario cuando se procesa una venta.",
  AJUSTE_ENTRADA: "Corrige faltantes en el inventario. Útil para registrar sobrantes o productos encontrados.",
  AJUSTE_SALIDA: "Corrige excesos en el inventario. Útil para registrar faltantes, productos dañados o vencidos.",
  TRASPASO_ENTRADA: "Registra productos recibidos desde otra tienda o almacén. Aumenta el inventario local.",
  TRASPASO_SALIDA: "Registra productos enviados hacia otra tienda o almacén. Disminuye el inventario local.",
  DESAGREGACION_BAJA: "Registra la baja de un producto que se fracciona o descompone en otros productos.",
  DESAGREGACION_ALTA: "Registra el alta de productos resultantes de la desagregación o fraccionamiento de otro producto.",
  CONSIGNACION_ENTRADA: "Registra la entrada de productos en consignación. Aumenta el inventario local.",
  CONSIGNACION_DEVOLUCION: "Registra la devolución de productos en consignación. Disminuye el inventario local."
};

// Ejemplos detallados para cada tipo de movimiento
export const TIPO_MOVIMIENTO_EJEMPLOS: Record<ITipoMovimiento, string> = {
  COMPRA: "Ejemplo: Compraste 50 unidades de Coca-Cola 500ml a $12 cada una. Este movimiento aumentará tu inventario en 50 unidades y registrará el costo de $600 total para calcular tu margen de ganancia.",
  VENTA: "Ejemplo: Un cliente compró 3 Coca-Colas 500ml. Este movimiento se crea automáticamente cuando procesas una venta en el sistema, reduciendo tu inventario en 3 unidades.",
  AJUSTE_ENTRADA: "Ejemplo: Durante el inventario físico encontraste 5 unidades adicionales de Galletas Oreo que no estaban registradas en el sistema. Este ajuste corrige el faltante sumando esas 5 unidades.",
  AJUSTE_SALIDA: "Ejemplo: Descubriste que 8 yogures se vencieron y tuviste que desecharlos, o se rompieron 3 botellas de refresco. Este ajuste reduce el inventario para reflejar la pérdida real.",
  TRASPASO_ENTRADA: "Ejemplo: Recibiste 30 paquetes de arroz desde tu almacén central o desde otra sucursal. Este movimiento aumenta el inventario de esta tienda específica.",
  TRASPASO_SALIDA: "Ejemplo: Enviaste 20 cajas de cereal a otra sucursal que se quedó sin stock. Este movimiento reduce el inventario de esta tienda y debe tener su correspondiente entrada en la tienda destino.",
  DESAGREGACION_BAJA: "Ejemplo: Tenías 1 caja de 24 refrescos y la abriste para vender las unidades por separado. Das de baja 1 caja completa para registrar las 24 unidades individuales.",
  DESAGREGACION_ALTA: "Ejemplo: Después de abrir la caja de 24 refrescos del ejemplo anterior, registras el alta de 24 unidades individuales que ahora puedes vender por separado.",
  CONSIGNACION_ENTRADA: "Ejemplo: Registraste 100 unidades de Coca-Cola 500ml en consignación de un proveedor determinado. Aumenta el inventario local.",
  CONSIGNACION_DEVOLUCION: "Ejemplo: Registraste 50 unidades de Coca-Cola 500ml en consignación. Disminuye el inventario local."
};

// Colores para cada tipo de movimiento
export const TIPO_MOVIMIENTO_COLORS: Record<ITipoMovimiento, string> = {
  COMPRA: "#2e7d32", // Verde oscuro
  VENTA: "#1976d2", // Azul
  AJUSTE_ENTRADA: "#388e3c", // Verde
  AJUSTE_SALIDA: "#f57c00", // Naranja
  TRASPASO_ENTRADA: "#0288d1", // Azul claro
  TRASPASO_SALIDA: "#0277bd", // Azul medio
  DESAGREGACION_BAJA: "#7b1fa2", // Púrpura
  DESAGREGACION_ALTA: "#8e24aa", // Púrpura claro
  CONSIGNACION_ENTRADA: "#2e7d32", // Verde oscuro
  CONSIGNACION_DEVOLUCION: "#1976d2" // Azul
}; 