import { NextRequest } from "next/server";
import { QAB_OUTBOX_PURGE_API_ERRORS } from "@/constants/qab";
import { isValidCronAuth } from "@/lib/cronAuth";
import { purgeQabOutboxEvents } from "@/lib/qab/outboxPurge";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UNAUTHORIZED_BODY = "Unauthorized";
const HTTP_UNAUTHORIZED = 401;
const HTTP_SERVER_ERROR = 500;

/**
 * Drops OutboxEvento rows the drain will never look at again. Invoked by Vercel
 * once a day; see `vercel.json`.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!isValidCronAuth(authHeader, process.env.CRON_SECRET)) {
    return new Response(UNAUTHORIZED_BODY, { status: HTTP_UNAUTHORIZED });
  }

  try {
    const report = await purgeQabOutboxEvents();
    return Response.json({ success: true, report });
  } catch {
    // Only a code is logged: the error can carry a database message and the
    // function's logs aggregate every business in one place.
    console.error(`qab.outboxPurge.failed code=${QAB_OUTBOX_PURGE_API_ERRORS.purgeFailed}`);
    return Response.json(
      { success: false, error: QAB_OUTBOX_PURGE_API_ERRORS.purgeFailed },
      { status: HTTP_SERVER_ERROR },
    );
  }
}
