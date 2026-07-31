import { NextRequest } from "next/server";
import {
  purgeExpiredIdempotencyKeys,
  IDEMPOTENCY_KEY_TTL_HOURS,
} from "@/lib/idempotency";

/**
 * Drops idempotency keys past their TTL. The table grows one row per protected
 * operation, so it needs a sweep to stay bounded.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const deleted = await purgeExpiredIdempotencyKeys();
    console.log(
      `🧹 Idempotency: ${deleted} claves de más de ${IDEMPOTENCY_KEY_TTL_HOURS}h eliminadas`,
    );
    return Response.json({ success: true, deleted });
  } catch (error) {
    console.error("❌ Idempotency: error purgando claves vencidas:", error);
    return Response.json(
      { success: false, error: "Error al purgar claves de idempotencia" },
      { status: 500 },
    );
  }
}
