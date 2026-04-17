import type { NextRequest } from "next/server";

/**
 * Base pública de la app (misma lógica que el formulario de landing / contact-form).
 */
export function getAppBaseUrlFromRequest(request: NextRequest | Request): string {
  const origin =
    "nextUrl" in request ? request.nextUrl.origin : new URL(request.url).origin;

  const rawBase = [origin, process.env.NEXTAUTH_URL]
    .filter((u): u is string => typeof u === "string" && u.trim().length > 0)
    .map((u) => u.replace(/\/$/, ""))[0];

  return rawBase ?? "http://localhost:3000";
}
