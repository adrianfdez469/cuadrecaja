import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { corsHeaders } from "@/middleware/cors";
import type { IHealthResponse } from "@/schemas/health";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const APP_VERSION = process.env.npm_package_version ?? "0.1.0";

/**
 * OPTIONS: preflight CORS (consistente con el resto de /api/app/*).
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

/**
 * GET /api/app/health
 *
 * Health check público para la APK. No requiere autenticación,
 * suscripción ni permisos. Verifica que el servidor responde y que
 * la base de datos está accesible.
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<IHealthResponse>> {
  const origin = request.headers.get("origin");
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        success: true,
        status: "ok",
        timestamp,
        version: APP_VERSION,
        services: { database: "up" },
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("❌ [APP/HEALTH] Base de datos no disponible:", error);

    return NextResponse.json(
      {
        success: false,
        status: "error",
        timestamp,
        version: APP_VERSION,
        services: { database: "down" },
      },
      { status: 503, headers: corsHeaders(origin) }
    );
  }
}
