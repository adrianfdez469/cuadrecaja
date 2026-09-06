import {
  MAX_SYNC_ATTEMPTS,
  RETRYABLE_CLIENT_ERROR_STATUSES,
} from "@/constants/pos";
import {
  faltanteExistenciaSchema,
  type IFaltanteExistencia,
} from "@/schemas/venta";
import { formatQuantity } from "@/utils/formatters";

/** Shape of what `createSell` rejects with. */
interface SyncErrorLike {
  message?: string;
  response?: {
    status?: number;
    data?: { error?: string; faltantes?: unknown };
  };
}

/**
 * Whether re-sending this sale unchanged could ever succeed.
 *
 * A 4xx is the server rejecting the request itself — a malformed payload, a
 * closed period, a sale that no longer belongs anywhere. Resending it byte for
 * byte will be rejected again, so the sale is parked instead of retried. The
 * two exceptions are timeouts and rate limits, which say "later", not "never".
 *
 * 5xx and network failures are deliberately not permanent: those are exactly
 * the outages the offline queue exists for.
 */
export function isPermanentSyncError(error: unknown): boolean {
  const status = (error as SyncErrorLike)?.response?.status;
  if (typeof status !== "number") return false;
  if (status < 400 || status >= 500) return false;
  return !RETRYABLE_CLIENT_ERROR_STATUSES.includes(status);
}

/**
 * Why a sale failed to reach the server, as far as the POS can tell.
 *
 * The three places that re-send a sale — the background sweep, the charge
 * itself and the manual button in the sales drawer — each had their own chain
 * of `message.includes(...)` checks, in different orders and disagreeing on
 * what was worth another attempt. This is that decision, in one place.
 */
export type SyncFailureKind =
  | "timeout"
  | "network"
  | "insufficient_stock"
  | "wrong_period"
  | "server"
  | "client"
  | "unknown";

/**
 * Two of these are business rejections the server states in prose rather than
 * in a status code, so they are matched on the text and checked first:
 *
 * - **Insufficient stock** is thrown inside the sale's transaction, so it comes
 *   back as a 500 and would otherwise pass for a transient server fault.
 * - **A sale outside the open period** is a 400 whose only distinguishing mark
 *   is its message.
 */
export function classifySyncFailure(error: unknown): SyncFailureKind {
  const candidate = error as SyncErrorLike;
  const text = `${candidate?.message ?? ""} ${candidate?.response?.data?.error ?? ""}`;

  if (text.includes("Existencia insuficiente")) return "insufficient_stock";
  if (text.includes("fuera del período actual")) return "wrong_period";
  if (text.includes("TIMEOUT_ERROR")) return "timeout";
  if (text.includes("NETWORK_ERROR")) return "network";
  if (text.includes("SERVER_ERROR")) return "server";
  if (text.includes("CLIENT_ERROR")) return "client";
  return "unknown";
}

/**
 * Whether the sale goes back into the automatic queue or is parked for the
 * cashier to re-send by hand.
 *
 * Parked is not lost: a parked sale still shows as pending and the sales
 * drawer re-sends it on demand. What it stops is the POS asking again on its
 * own for something that already has its answer — a sale with no stock behind
 * it will be refused just as fast the tenth time, and each round costs the
 * cashier a toast and the connection a request.
 *
 * [attemptsMade] counts the attempt that just failed, so with
 * `MAX_SYNC_ATTEMPTS` at 5 the sale is sent exactly five times before it is
 * parked.
 */
export function shouldRetrySyncFailure(
  error: unknown,
  attemptsMade: number,
): boolean {
  const kind = classifySyncFailure(error);
  // The server already gave its verdict on these two; time does not change it.
  // Restocking or opening a new period does, and either is the cashier's move,
  // which is why the sale waits for them and not for the next sweep.
  if (kind === "insufficient_stock" || kind === "wrong_period") return false;
  if (isPermanentSyncError(error)) return false;
  return attemptsMade < MAX_SYNC_ATTEMPTS;
}

/**
 * Las líneas que la tienda no pudo cubrir, según el servidor.
 *
 * Se validan en vez de darlas por buenas: es una respuesta que llega por la
 * red, y una venta antigua reenviada contra un servidor anterior a este
 * cambio no trae nada de esto.
 */
export function getInsufficientStockItems(
  error: unknown,
): IFaltanteExistencia[] {
  const parsed = faltanteExistenciaSchema
    .array()
    .safeParse((error as SyncErrorLike)?.response?.data?.faltantes);
  return parsed.success ? parsed.data : [];
}

/**
 * Esas mismas líneas, en una frase: «Cerveza: pide 5, hay 2 · Ron: pide 3, hay
 * 0». Cadena vacía si el servidor no dijo cuáles, para que quien la use no
 * tenga que distinguir entre «no hay detalle» y «hay detalle vacío».
 */
export function describeInsufficientStock(
  items: IFaltanteExistencia[],
): string {
  return items
    .map(
      (item) =>
        `${item.nombre}: pide ${formatQuantity(item.solicitada)}, hay ${formatQuantity(item.disponible)}`,
    )
    .join(" · ");
}
