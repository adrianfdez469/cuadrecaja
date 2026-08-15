"use client";

import { useCallback, useEffect, useMemo } from "react";
import { defaultDeviceConfig } from "../transports/createTransport";
import { useAppContext } from "@/context/AppContext";
import { Sale } from "@/store/salesStore";
import { printService } from "../services/printService";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { usePrintTemplateCache } from "../store/printTemplateCache";
import { IPrintSaleContext } from "../types/ITicketData";

export function usePrintContext(): IPrintSaleContext | null {
  const { user, monedaBase } = useAppContext();
  // Memoized: this used to build a fresh object on every render, and it is a
  // dependency of `printSale`/`reprintSale`/`testPrint` below — so all three
  // changed identity on every render, and any effect depending on them re-ran
  // every single time.
  return useMemo(() => {
    if (!user?.localActual) return null;
    return {
      tiendaNombre: user.localActual.nombre,
      negocioNombre: user.negocio.nombre,
      cajeroNombre: user.nombre,
      monedaBase: monedaBase ?? user.negocio.monedaBase ?? "CUP",
    };
  }, [
    user?.localActual?.nombre,
    user?.negocio?.nombre,
    user?.negocio?.monedaBase,
    user?.nombre,
    monedaBase,
  ]);
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

  // Pure read. This used to call `getConfigForTienda`, which writes to the
  // store — during render, and from a component subscribed to that same store.
  // React answered with "Cannot update a component while rendering a different
  // component" and an extra synchronous render pass of the whole POS on every
  // render where the config did not yet match the store. The effect above is
  // what persists the default; here we only need a value to render with.
  const activeConfig = useMemo(() => {
    if (!effectiveTiendaId) return null;
    return config?.tiendaId === effectiveTiendaId
      ? config
      : defaultDeviceConfig(effectiveTiendaId);
  }, [config, effectiveTiendaId]);

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
