import type { Prisma } from "@prisma/client";

/** Log tags of the order-poll slot. They are the executable evidence of criterion 6. */
export const QAB_ORDER_POLL_ENTER_LOG = "qab.orderPoll.enter";
export const QAB_ORDER_POLL_SKIPPED_LOG = "qab.orderPoll.skipped";
export const QAB_ORDER_POLL_SKIPPED_REASON_LOCK_HELD = "lock_held";

export interface IQabOrderPullArgs {
  tx: Prisma.TransactionClient;
  negocioId: string;
  token: string;
  baseUrl: string;
}

export interface IQabOrderPullReport {
  pulled: number;
  /** false while F-010 has not filled this in. */
  implemented: boolean;
}

/**
 * F-002 builds the slot; F-010 fills it with GET /api/internal/orders, the cursor
 * advance on `Negocio.qabUltimoPedidoVisto` and the `PedidoEntrante` writes.
 * In F-002 the body performs NO network call and returns `{ pulled: 0, implemented: false }`.
 *
 * It logs exactly one line on entry — that log is what makes criterion 6 verifiable
 * today: with two concurrent runs it must appear ONCE per business, never twice.
 */
export async function pullQabOrders(args: IQabOrderPullArgs): Promise<IQabOrderPullReport> {
  console.log(`${QAB_ORDER_POLL_ENTER_LOG} negocioId=${args.negocioId}`);
  return { pulled: 0, implemented: false };
}
