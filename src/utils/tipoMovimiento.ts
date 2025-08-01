import { ITipoMovimiento } from "@/types/IMovimiento";

export const isMovimientoBaja = (tipo: ITipoMovimiento) => {
  return tipo === 'AJUSTE_SALIDA' 
  || tipo === "TRASPASO_SALIDA" 
  || tipo === "VENTA" 
  || tipo === "DESAGREGACION_BAJA"
  || tipo === "CONSIGNACION_DEVOLUCION";
}