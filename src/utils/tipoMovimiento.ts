import { ITipoMovimiento } from "@/schemas/movimiento";

export const isMovimientoBaja = (tipo: ITipoMovimiento) => {
  return (
    tipo === "AJUSTE_SALIDA" ||
    tipo === "TRASPASO_SALIDA" ||
    tipo === "VENTA" ||
    tipo === "DESAGREGACION_BAJA" ||
    tipo === "CONSIGNACION_DEVOLUCION" ||
    tipo === "MERMA"
  );
};

/**
 * Movement types a consigned row must never take. The goods on those rows
 * belong to the supplier, and what the business owes for them is derived from
 * `ProductoTienda.existencia` plus the period's sales — a purchase would buy
 * stock the shop does not own, and an adjustment would add or erase someone
 * else's goods with no counterpart. The legitimate ways in and out are the
 * consignment movements themselves; a real loss is a MERMA (absorbed by the
 * business) and a return to the supplier is a CONSIGNACION_DEVOLUCION.
 */
export const FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES: ITipoMovimiento[] = [
  "COMPRA",
  "AJUSTE_ENTRADA",
  "AJUSTE_SALIDA",
];

export const isMovementAllowedOnConsignment = (tipo: ITipoMovimiento) =>
  !FORBIDDEN_CONSIGNMENT_MOVEMENT_TYPES.includes(tipo);
