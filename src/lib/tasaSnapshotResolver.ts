import { prisma } from "@/lib/prisma";
import {
  buildTasaSnapshot,
  buildTasaSnapshotAt,
  completeTasaSnapshot,
  missingRateCodes,
} from "@/lib/currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

export const MISSING_EXCHANGE_RATE_ERROR = "MISSING_EXCHANGE_RATE";

export interface IResolveSaleTasaSnapshotParams {
  negocioId: string | null | undefined;
  monedaBase: string;
  /** Snapshot sent by the client; its rates always take precedence. */
  clientSnapshot: ITasaSnapshot | null | undefined;
  /** When the sale actually happened (frontendCreatedAt for offline sales). */
  momento: Date;
  /** Monedas of every payment and change line of the sale. */
  monedas: string[];
}

export interface IResolvedSaleTasaSnapshot {
  /** Client snapshot completed with the business rates; safe to persist. */
  snapshot: ITasaSnapshot;
  /** Monedas the sale needs a rate for that could not be resolved anywhere. */
  missing: string[];
}

/**
 * Completes the tasaSnapshot of a sale being created.
 *
 * Clients are not a trustworthy source for a complete snapshot: the mobile app
 * used to omit the business's own monedaBase, and a web session can hold rates
 * loaded before a new moneda was registered. Any moneda missing from the
 * snapshot silently converts at rate 1 downstream, so the gaps are filled here,
 * once, before anything is persisted.
 *
 * Precedence: client snapshot → rate in force at `momento` → latest known
 * rate. The client's rates are never overridden — they are what the customer
 * was actually charged with.
 */
export async function resolveSaleTasaSnapshot({
  negocioId,
  monedaBase,
  clientSnapshot,
  momento,
  monedas,
}: IResolveSaleTasaSnapshotParams): Promise<IResolvedSaleTasaSnapshot> {
  const history = negocioId
    ? await prisma.tasaCambio.findMany({
        where: { negocioId },
        orderBy: { createdAt: "asc" },
        select: { monedaCode: true, tasa: true, createdAt: true },
      })
    : [];

  const at = Number.isNaN(momento.getTime()) ? new Date() : momento;

  const snapshot = completeTasaSnapshot(
    clientSnapshot,
    buildTasaSnapshotAt(history, at),
    buildTasaSnapshot(history),
  );

  return {
    snapshot,
    missing: missingRateCodes(snapshot, monedaBase, monedas),
  };
}

/** User-facing message for a sale rejected because a required rate is missing. */
export function missingExchangeRateMessage(codes: string[]): string {
  return `No hay tasa de cambio registrada para ${codes.join(", ")}. Regístrala en Configuración → Tasas de cambio antes de cobrar en otra moneda.`;
}
