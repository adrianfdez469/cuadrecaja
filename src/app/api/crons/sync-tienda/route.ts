import { timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { QAB_SYNC_API_ERRORS } from "@/constants/qab";
import { QabConfigError } from "@/lib/qab/qabEnv";
import { runQabSyncTiendaCron } from "@/lib/qab/syncTiendaCron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNAUTHORIZED_BODY = "Unauthorized";
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;

function isValidCronAuth(authHeader: string | null, secret: string | undefined): boolean {
  // Fail-closed: without the variable, `Bearer undefined` must not be a valid
  // credential (ADR 0014).
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader ?? "");
  // Lengths first: timingSafeEqual requires buffers of the same size and would
  // throw instead of simply returning `false`.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Drains the QAB outbox and runs the order-poll slot. Invoked by Vercel every
 * two minutes; see `vercel.json`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronAuth(authHeader, process.env.CRON_SECRET)) {
    return new Response(UNAUTHORIZED_BODY, { status: HTTP_UNAUTHORIZED });
  }

  try {
    const report = await runQabSyncTiendaCron();
    return Response.json({ success: true, report });
  } catch (error) {
    // Only a code is logged, never the error itself: a QAB response body is
    // unverified third-party content and the function's logs aggregate every
    // business in one place. See the logging rule of the F-002 contract.
    if (error instanceof QabConfigError) {
      console.error(`qab.sync.failed code=${QAB_SYNC_API_ERRORS.configInvalid}`);
      return Response.json(
        { success: false, error: QAB_SYNC_API_ERRORS.configInvalid },
        { status: HTTP_SERVER_ERROR },
      );
    }
    console.error(`qab.sync.failed code=${QAB_SYNC_API_ERRORS.syncFailed}`);
    return Response.json(
      { success: false, error: QAB_SYNC_API_ERRORS.syncFailed },
      { status: HTTP_SERVER_ERROR },
    );
  }
}
