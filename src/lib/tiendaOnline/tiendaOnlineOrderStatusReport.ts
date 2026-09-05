import { TIENDA_ONLINE_ORDER_STATUS_NOT_WRITTEN_CAUSE } from "@/constants/tiendaOnline";
import { resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import { postQabOrderStatus } from "@/lib/qab/qabOrderStatusClient";
import type {
  IQabOrderStatusFailureCode,
  IQabOrderStatusReportable,
} from "@/lib/qab/qabOrderStatusClient";
import { loadQabToken } from "@/lib/qab/qabToken";
import {
  orderStatusDivergedLogLine,
  orderStatusWriteFailureCause,
} from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import { writeTiendaOnlineOrderStatus } from "@/lib/tiendaOnline/tiendaOnlineOrders";

/**
 * The failure split of reporting one status, and the only place it lives.
 * See ADR 0063.
 */

/**
 * The outcome of reporting one status. `persisted` exists ONLY inside the branch
 * where QAB already accepted, so "QAB refused but we wrote it" is not a
 * representable state — the same trick ADR 0059 uses for the amounts.
 */
export type ITiendaOnlineOrderStatusReport =
  | { kind: "applied"; status: IQabOrderStatusReportable; persisted: boolean }
  | { kind: "refused"; code: IQabOrderStatusFailureCode };

/** One row changed: anything else is a write that did not land (E-024). */
const WRITTEN_ROW_COUNT = 1;

/**
 * Reports one status to QAB and, ONLY if QAB accepts, writes it locally.
 *
 * The steps, in this order and no other:
 *
 *   1. `resolveQabBaseUrl()`. `null` -> refused NOT_CONFIGURED. A QabConfigError
 *      is NOT caught here: it is a misconfiguration of this deployment, not an
 *      outcome of the call, and it leaves through the route's outer catch as a
 *      500 — the same thing the slug forecast route does.
 *   2. `loadQabToken(negocioId)`. `null` -> refused NOT_CONFIGURED. Read HERE and
 *      not earlier: a caller who is about to get a 403 or a 404 never causes a
 *      secret to be read.
 *   3. `postQabOrderStatus(...)`, exactly once. No loop, no retry.
 *   4. `{ kind: "error" }` -> refused with that code, AND NOTHING IS WRITTEN.
 *      That is acceptance criterion 8, and it holds for every failure without
 *      exception: 400, 401, 403, 404, 409, 503, an undocumented status, a
 *      transport failure and an unreadable 200 all leave through this line.
 *   5. `{ kind: "ok" }` -> the local write, inside a `try/catch`. Both the
 *      "wrote nothing" branch and the "threw" branch answer `persisted: false`
 *      and write ONE divergence line; the caught error itself is NEVER logged
 *      (E-031).
 *
 * Nothing else is written to the database in any branch: no attempt counter, no
 * failure marker, and no column other than `status`.
 */
export async function reportTiendaOnlineOrderStatus(params: {
  negocioId: string;
  pedidoId: string;
  qabOrderId: string;
  status: IQabOrderStatusReportable;
}): Promise<ITiendaOnlineOrderStatusReport> {
  const { negocioId, pedidoId, qabOrderId, status } = params;

  const baseUrl = resolveQabBaseUrl();
  if (baseUrl === null) return { kind: "refused", code: "NOT_CONFIGURED" };

  const token = await loadQabToken(negocioId);
  if (token === null) return { kind: "refused", code: "NOT_CONFIGURED" };

  const outcome = await postQabOrderStatus({
    baseUrl,
    token,
    qabOrderId,
    status,
  });
  if (outcome.kind === "error") {
    return { kind: "refused", code: outcome.code };
  }

  // From here on QAB has accepted: the buyer already sees the new status, and
  // nothing below can turn this back into a refusal (ADR 0063).
  let written: number;
  try {
    written = await writeTiendaOnlineOrderStatus({
      negocioId,
      pedidoId,
      status,
    });
  } catch (error) {
    console.error(
      orderStatusDivergedLogLine({
        pedidoId,
        status,
        cause: orderStatusWriteFailureCause(error),
      }),
    );
    return { kind: "applied", status, persisted: false };
  }

  if (written === WRITTEN_ROW_COUNT) {
    return { kind: "applied", status, persisted: true };
  }

  console.error(
    orderStatusDivergedLogLine({
      pedidoId,
      status,
      cause: TIENDA_ONLINE_ORDER_STATUS_NOT_WRITTEN_CAUSE,
    }),
  );
  return { kind: "applied", status, persisted: false };
}
