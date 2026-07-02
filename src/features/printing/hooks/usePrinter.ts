"use client";

import { useCallback, useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { Sale } from "@/store/salesStore";
import { printService } from "../services/printService";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { usePrintTemplateCache } from "../store/printTemplateCache";
import { IPrintSaleContext } from "../types/ITicketData";

export function usePrintContext(): IPrintSaleContext | null {
  const { user, monedaBase } = useAppContext();
  if (!user?.localActual) return null;
  return {
    tiendaNombre: user.localActual.nombre,
    negocioNombre: user.negocio.nombre,
    cajeroNombre: user.nombre,
    monedaBase: monedaBase ?? user.negocio.monedaBase ?? "CUP",
  };
}

export function usePrinter(tiendaId?: string) {
  const { user } = useAppContext();
  const effectiveTiendaId = tiendaId ?? user?.localActual?.id ?? "";
  const context = usePrintContext();
  const config = usePrintDeviceStore((s) => s.config);

  useEffect(() => {
    if (effectiveTiendaId) {
      usePrintDeviceStore.getState().getConfigForTienda(effectiveTiendaId);
    }
  }, [effectiveTiendaId]);

  const activeConfig =
    config?.tiendaId === effectiveTiendaId
      ? config
      : effectiveTiendaId
        ? usePrintDeviceStore.getState().getConfigForTienda(effectiveTiendaId)
        : null;

  const prefetchTemplate = useCallback(async () => {
    if (!effectiveTiendaId) return;
    await usePrintTemplateCache.getState().fetchAndCache(effectiveTiendaId);
  }, [effectiveTiendaId]);

  const printSale = useCallback(
    async (sale: Sale, force = false) => {
      if (!effectiveTiendaId || !context) return;
      await printService.printSale({
        sale,
        tiendaId: effectiveTiendaId,
        context,
        force,
      });
    },
    [effectiveTiendaId, context],
  );

  const reprintSale = useCallback(
    async (sale: Sale) => {
      if (!effectiveTiendaId || !context) return;
      await printService.reprintSale({
        sale,
        tiendaId: effectiveTiendaId,
        context,
      });
    },
    [effectiveTiendaId, context],
  );

  const testPrint = useCallback(async () => {
    if (!effectiveTiendaId || !context) return;
    await printService.testPrint(effectiveTiendaId, context);
  }, [effectiveTiendaId, context]);

  const flushQueue = useCallback(async () => {
    if (!effectiveTiendaId) return 0;
    return printService.flushQueue(effectiveTiendaId);
  }, [effectiveTiendaId]);

  return {
    config: activeConfig,
    context,
    effectiveTiendaId,
    prefetchTemplate,
    printSale,
    reprintSale,
    testPrint,
    flushQueue,
  };
}
