import { ITipoMovimiento } from "@/schemas/movimiento";

export const isMovimientoBaja = (tipo: ITipoMovimiento) => {
  return tipo === 'AJUSTE_SALIDA' 
  || tipo === "TRASPASO_SALIDA" 
  || tipo === "VENTA" 
  || tipo === "DESAGREGACION_BAJA"
  || tipo === "CONSIGNACION_DEVOLUCION";
}