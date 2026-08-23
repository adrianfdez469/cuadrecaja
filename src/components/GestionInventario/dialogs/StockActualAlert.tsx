"use client";

import { Alert } from "@mui/material";
import { formatQuantity } from "@/utils/formatters";

interface Props {
  existencia: number;
  /** Supplier the shown stock belongs to, when the row is a consigned one. */
  proveedorNombre?: string | null;
  /**
   * True when the selected supplier has no ProductoTienda row for this product
   * in the store — the shown stock is 0 because the row does not exist yet.
   */
  sinFilaProveedor?: boolean;
  esSalida?: boolean;
}

/**
 * Header of the movement dialogs: the stock the form validates against, plus
 * the supplier that stock belongs to. Consigned goods live in one
 * ProductoTienda row per supplier, so this figure follows the selected
 * supplier, not the row the dialog was opened from.
 */
export function StockActualAlert({
  existencia,
  proveedorNombre,
  sinFilaProveedor,
  esSalida,
}: Props) {
  return (
    <>
      <Alert severity="info">
        Stock actual: <strong>{formatQuantity(existencia)}</strong>
        {proveedorNombre && (
          <>
            {" "}
            · Proveedor: <strong>{proveedorNombre}</strong>
          </>
        )}
      </Alert>

      {sinFilaProveedor && (
        <Alert severity={esSalida ? "warning" : "info"}>
          {esSalida
            ? "Este proveedor no tiene existencia de este producto en la tienda."
            : "Este proveedor todavía no tiene este producto en consignación: la existencia arranca en 0."}
        </Alert>
      )}
    </>
  );
}
