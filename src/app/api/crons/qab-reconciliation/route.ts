import { NextRequest } from "next/server";
import {
  QAB_RECONCILIATION_API_ERRORS,
  QAB_RECONCILIATION_LOG,
  QAB_RECONCILIATION_MAX_STORES_PER_RUN,
  QAB_SYNC_API_ERRORS,
} from "@/constants/qab";
import { isValidCronAuth } from "@/lib/cronAuth";
import { QabConfigError } from "@/lib/qab/qabEnv";
import { runQabReconciliationCron } from "@/lib/qab/qabReconciliationCron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNAUTHORIZED_BODY = "Unauthorized";
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;
const TIENDA_ID_PARAM = "tiendaId";

/**
 * Runs one reconciliation pass. Gated by `isValidCronAuth`
 * (`src/lib/cronAuth.ts`) — the SAME function `sync-tienda` and
 * `purge-outbox-events` use, not a new gate and not a relaxed one. Fail-closed
 * (ADR 0014): no `Authorization` is 401, `Bearer ${CRON_SECRET}` is 200, and
 * CRON_SECRET absent from the environment is 401 as well, never 200.
 *
 * `?tiendaId=` may be repeated to force specific stores; at most
 * QAB_RECONCILIATION_MAX_STORES_PER_RUN of them are read, the rest are ignored.
 * Read with `request.nextUrl.searchParams.getAll(...)`; each value must be a
 * non-empty string or it is dropped.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronAuth(authHeader, process.env.CRON_SECRET)) {
    return new Response(UNAUTHORIZED_BODY, { status: HTTP_UNAUTHORIZED });
  }

  const requested = request.nextUrl.searchParams
    .getAll(TIENDA_ID_PARAM)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .slice(0, QAB_RECONCILIATION_MAX_STORES_PER_RUN);

  try {
    const report = await runQabReconciliationCron(
      requested.length > 0 ? { tiendaIds: requested } : undefined,
    );
    return Response.json({ success: true, report });
  } catch (error) {
    // Only a code is logged, never the error itself: a QAB response body is
    // unverified third-party content and the function's logs aggregate every
    // business in one place. See the logging rule of the F-002 contract.
    if (error instanceof QabConfigError) {
      console.error(`${QAB_RECONCILIATION_LOG}.failed code=${QAB_SYNC_API_ERRORS.configInvalid}`);
      return Response.json(
        { success: false, error: QAB_SYNC_API_ERRORS.configInvalid },
        { status: HTTP_SERVER_ERROR },
      );
    }
    console.error(
      `${QAB_RECONCILIATION_LOG}.failed code=${QAB_RECONCILIATION_API_ERRORS.reconciliationFailed}`,
    );
    return Response.json(
      { success: false, error: QAB_RECONCILIATION_API_ERRORS.reconciliationFailed },
      { status: HTTP_SERVER_ERROR },
    );
  }
}
