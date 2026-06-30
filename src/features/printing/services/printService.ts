import { PRINT_QUEUE_MAX_ATTEMPTS } from "@/constants/ticket";
import { DEFAULT_TICKET_PLANTILLA } from "@/schemas/ticketPlantilla";
import { Sale } from "@/store/salesStore";
import { buildTicketPayload } from "../lib/buildTicketPayload";
import { encodeTicketToEscPos } from "../lib/escpos/encoder";
import { usePrintDeviceStore } from "../store/printDeviceStore";
import { usePrintQueueStore } from "../store/printQueueStore";
import { usePrintTemplateCache } from "../store/printTemplateCache";
import { IPrintSaleContext } from "../types/ITicketData";
import { createTransport } from "../transports/createTransport";
import { BrowserFallbackTransport } from "../transports/browserFallbackTransport";

async function resolvePlantilla(tiendaId: string) {
  const cache = usePrintTemplateCache.getState();
  try {
    return await cache.fetchAndCache(tiendaId);
  } catch {
    const cached = cache.getPlantilla(tiendaId);
    if (cached) return cached;
    return { tiendaId, ...DEFAULT_TICKET_PLANTILLA };
  }
}

async function printPayload(
  payload: ReturnType<typeof buildTicketPayload>,
  tiendaId: string,
): Promise<void> {
  const deviceStore = usePrintDeviceStore.getState();
  const config = deviceStore.getConfigForTienda(tiendaId);
  const transport = createTransport(config, payload);
  if (transport instanceof BrowserFallbackTransport) {
    transport.setPayload(payload);
  }

  const bytes = encodeTicketToEscPos(payload);
  const copies = Math.max(1, config.copias);

  await transport.connect();
  for (let i = 0; i < copies; i++) {
    await transport.print(bytes);
  }
}

export const printService = {
  async printSale(params: {
    sale: Sale;
    tiendaId: string;
    context: IPrintSaleContext;
    force?: boolean;
  }): Promise<void> {
    const { sale, tiendaId, context, force = false } = params;
    const deviceStore = usePrintDeviceStore.getState();
    const config = deviceStore.getConfigForTienda(tiendaId);

    if (!force && !config.autoPrint && config.transportType !== "browser") {
      return;
    }

    const plantilla = await resolvePlantilla(tiendaId);
    const payload = buildTicketPayload(sale, plantilla, context);
    const queue = usePrintQueueStore.getState();

    try {
      await printPayload(payload, tiendaId);
      const pending = queue.jobs.find(
        (j) => j.saleIdentifier === sale.identifier && j.status !== "done",
      );
      if (pending) queue.markDone(pending.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al imprimir ticket";
      const jobId = queue.enqueue({
        saleIdentifier: sale.identifier,
        tiendaId,
        payload,
        lastError: message,
      });
      queue.markFailed(jobId, message);
      throw error;
    }
  },

  async reprintSale(params: {
    sale: Sale;
    tiendaId: string;
    context: IPrintSaleContext;
  }): Promise<void> {
    await printService.printSale({ ...params, force: true });
  },

  async testPrint(tiendaId: string, context: IPrintSaleContext): Promise<void> {
    const sampleSale: Sale = {
      identifier: "test-00000000-0000-4000-8000-000000000001",
      tiendaId,
      cierreId: "test",
      usuarioId: "test",
      total: 250,
      totalcash: 200,
      totaltransfer: 50,
      productos: [
        {
          cantidad: 2,
          productoTiendaId: "pt1",
          productId: "p1",
          name: "Pasta de Dientes Artesanal Caribe Bello",
          price: 75,
        },
        {
          cantidad: 1,
          productoTiendaId: "pt2",
          productId: "p2",
          name: "Refresco Cola 2L",
          price: 100,
        },
      ],
      synced: false,
      syncState: "synced",
      createdAt: Date.now(),
      wasOffline: false,
      syncAttempts: 0,
    };

    await printService.printSale({
      sale: sampleSale,
      tiendaId,
      context,
      force: true,
    });
  },

  async flushQueue(tiendaId: string): Promise<number> {
    const queue = usePrintQueueStore.getState();
    const pending = queue
      .getPendingJobs()
      .filter((j) => j.tiendaId === tiendaId && j.attempts < PRINT_QUEUE_MAX_ATTEMPTS);

    let printed = 0;
    for (const job of pending) {
      try {
        queue.markPrinting(job.id);
        await printPayload(job.payload, tiendaId);
        queue.markDone(job.id);
        printed++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error al reimprimir";
        if (job.attempts >= PRINT_QUEUE_MAX_ATTEMPTS) {
          queue.markFailed(job.id, message);
        } else {
          queue.markFailed(job.id, message);
        }
      }
    }
    return printed;
  },
};
