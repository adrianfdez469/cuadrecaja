"use client";

import { useCallback } from "react";
import { Sale } from "@/store/salesStore";
import { printService } from "../services/printService";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { IPrintSaleContext } from "../types/ITicketData";

/**
 * Dispara impresión post-venta sin bloquear el flujo de cobro.
 */
export function usePrintOnSale() {
  const triggerPrint = useCallback(
    (params: {
      sale: Sale;
      tiendaId: string;
      context: IPrintSaleContext;
    }) => {
      const config = usePrintDeviceStore
        .getState()
        .getConfigForTienda(params.tiendaId);

      if (!config.autoPrint) return;

      void printService
        .printSale({ ...params, force: false })
        .catch(() => {
          /* errores manejados en cola interna */
        });
    },
    [],
  );

  return { triggerPrint };
}
