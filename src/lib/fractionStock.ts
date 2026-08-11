/**
 * How a sale of loose units draws from the packs behind them.
 *
 * A fractioned product (`Producto.fraccionDeId` + `unidadesPorFraccion`) is
 * sold one unit at a time, but the store also holds whole parent units — a
 * box of cigarettes, a crate of beer. When a sale needs more loose units than
 * are on the shelf, the POS opens as many parent units as it takes and books
 * the pair of movements the ledger expects: `DESAGREGACION_BAJA` on the
 * parent, `DESAGREGACION_ALTA` on the fraction.
 *
 * Selling more than one pack's worth in a single sale used to be rejected
 * outright; it is now just a sale that opens several packs.
 */
export function packsToOpen(
  quantitySold: number,
  looseStock: number,
  unitsPerPack: number | null | undefined,
): number {
  if (!unitsPerPack || unitsPerPack <= 0) return 0;
  const missing = quantitySold - looseStock;
  if (missing <= 0) return 0;
  return Math.ceil(missing / unitsPerPack);
}

/**
 * Loose units the opened packs put on the shelf. Whole packs are opened, so
 * this is normally more than the sale needs — the surplus stays as stock.
 */
export function unitsFromPacks(
  packs: number,
  unitsPerPack: number | null | undefined,
): number {
  if (!unitsPerPack || unitsPerPack <= 0) return 0;
  return packs * unitsPerPack;
}
