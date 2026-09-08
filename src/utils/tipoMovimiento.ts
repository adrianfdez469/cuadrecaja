import { ITipoMovimiento } from "@/schemas/movimiento";

export const isMovimientoBaja = (tipo: ITipoMovimiento) => {
  return (
    tipo === "AJUSTE_SALIDA" ||
    tipo === "TRASPASO_SALIDA" ||
    tipo === "VENTA" ||
    tipo === "DESAGREGACION_BAJA" ||
    tipo === "CONSIGNACION_DEVOLUCION" ||
    tipo === "MERMA" ||
    // F-014: the online order's reservation takes the goods out of the store
    // when the order is confirmed (ADR 0071). Its release is an alta and is
    // deliberately NOT here.
    tipo === "PEDIDO_ONLINE_RESERVA"
  );
};

/**
 * Stock the product was left with once the movement was applied.
 *
 * The row only stores the count BEFORE it (`existenciaAnterior`, nullable for
 * rows written before that column existed) and a `cantidad` that is always
 * positive — the direction lives in the type, not in the sign. Returns null
 * when the count before is unknown, so the caller prints its fallback instead
 * of a number it made up.
 */
export const getStockAfterMovement = (
  stockBefore: number | null | undefined,
  quantity: number,
  tipo: ITipoMovimiento,
): number | null => {
  if (stockBefore === null || stockBefore === undefined) return null;
  return isMovimientoBaja(tipo)
    ? stockBefore - quantity
    : stockBefore + quantity;
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
