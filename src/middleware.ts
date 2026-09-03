// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { subscriptionMiddleware } from "@/middleware/subscriptionCheck";
import { handleCorsMiddleware, addCorsHeaders } from "@/middleware/cors";
import { isApiPath, requiresApiAuth } from "@/middleware/apiAuthGate";
import { buildSanitizedHeaders } from "@/middleware/userHeaders";
import { UNAUTHORIZED_ERROR_CODE } from "@/constants/apiAuth";
import type { IUserHeaderClaims } from "@/schemas/userHeaders";

/**
 * The gate's 401: "there is no session", never "you are not allowed".
 * An authorisation failure is a 403 inside the handler — src/lib/axiosClient.ts
 * signs the user out on ANY 401, so one 401 too many logs people out. F-018.
 */
function unauthorizedResponse(origin: string | null): NextResponse {
  const response = NextResponse.json(
    { error: UNAUTHORIZED_ERROR_CODE },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
  return addCorsHeaders(response, origin);
}

export async function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  // Read outside the try so the catch can still fail closed on a gated route.
  let gated = false;

  try {
    const { pathname } = req.nextUrl;

    // 1. 🌐 CORS: preflight (OPTIONS) is answered before anything else. The gate
    //    never gets in front of it: breaking the preflight takes down web and
    //    APK at the same time.
    const corsResponse = handleCorsMiddleware(req);
    if (corsResponse) return corsResponse;

    // 2. Gate verdict: pure string logic over the pathname (ADR 0017).
    gated = requiresApiAuth(pathname);

    // 3. Session token. Only the NextAuth cookie is validated here (ADR 0016):
    //    the APK's Bearer is handled by /api/app, which is allowlisted.
    let token: IUserHeaderClaims | null = null;
    try {
      token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    } catch (tokenError) {
      // A missing NEXTAUTH_SECRET or an undecodable cookie fails closed.
      console.error("❌ [MIDDLEWARE] Could not read the session token:", tokenError);
      token = null;
    }

    // 4. Sanitised headers: ALWAYS, gated or not, API or page. Every incoming
    //    x-user-* is dropped before any early return (criterion 4, ADR 0018).
    const requestHeaders = buildSanitizedHeaders(req.headers, token);

    // 5. The gate itself.
    if (gated && !token) {
      return unauthorizedResponse(origin);
    }

    // 6. Pages: subscription check, with the sanitised headers.
    if (!isApiPath(pathname)) {
      const requestWithHeaders = new NextRequest(req.url, {
        ...req,
        headers: requestHeaders,
      });
      const response = await subscriptionMiddleware(
        requestWithHeaders,
        requestHeaders,
      );
      return addCorsHeaders(response, origin);
    }

    // 7. APIs: forward the sanitised headers + CORS.
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error("❌ [MIDDLEWARE] Error crítico en middleware:", error);

    // 8. Fail closed on a gated route: this catch must never become the
    //    exception that cancels the gate.
    if (gated) {
      return unauthorizedResponse(origin);
    }

    // On a page, let the request through — but never with the raw client
    // headers, or this branch would reintroduce exactly what step 4 closes.
    const response = NextResponse.next({
      request: {
        headers: buildSanitizedHeaders(req.headers, null),
      },
    });
    return addCorsHeaders(response, origin);
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    // Incluir todas las rutas excepto: _next, static assets, login, subscription-expired
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|login|activar|activar-usuario|restablecer-contrasena|olvide-contrasena|subscription-expired|descargar|forbidden).*)',
  ],
}
