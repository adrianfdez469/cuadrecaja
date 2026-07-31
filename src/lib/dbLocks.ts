import { Prisma } from "@prisma/client";

/**
 * Locks a row by id inside the transaction and reports whether it still exists.
 * Returns `false` when another transaction already deleted it.
 *
 * What it is for: an operation that reverses effects (returning stock, undoing
 * payments) is not idempotent, so repeating it applies the effect twice. The
 * real-world case is a network retry overlapping the original request, which is
 * still running because the server does not cancel anything when the client
 * aborts.
 *
 * Called as the first operation of the transaction, the second execution waits
 * for the first one to finish and then sees the row gone, so it bails out before
 * touching anything. Without the lock it would read the previous state and
 * duplicate the work.
 *
 * The table name is interpolated into the SQL: that is why it is a closed union
 * and can never come from user input. The id is parameterised.
 */
export type LockableTable =
  "Venta" | "VentaProducto" | "CierrePeriodo" | "ProductoTienda";

export const lockExistingRow = async (
  tx: Prisma.TransactionClient,
  table: LockableTable,
  id: string,
): Promise<boolean> => {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`,
    id,
  );
  return rows.length > 0;
};

/**
 * Same as `lockExistingRow`, but for tables with soft delete: returns `false`
 * if the row was already flagged as deleted.
 *
 * Used when the work being protected needs the row to stay *active* while it
 * runs — for instance the outbound adjustment when deleting a product, which
 * resolves the `ProductoTienda` by `deletedAt: null`. Hence the lock-and-check
 * up front, with `deletedAt` written only at the end: flagging it earlier would
 * make the work itself stop finding the row.
 */
export const lockActiveRow = async (
  tx: Prisma.TransactionClient,
  table: LockableTable,
  id: string,
): Promise<boolean> => {
  const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "${table}" WHERE "id" = $1 AND "deletedAt" IS NULL FOR UPDATE`,
    id,
  );
  return rows.length > 0;
};
