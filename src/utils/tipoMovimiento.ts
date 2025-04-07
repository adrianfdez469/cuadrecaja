import { ITipoMovimiento } from "@/types/IMovimiento";

export const isMovimientoBaja = (tipo: ITipoMovimiento) => {
  return tipo === 'AJUSTE_SALIDA' || tipo === "TRASPASO_SALIDA" || tipo === "VENTA";
}