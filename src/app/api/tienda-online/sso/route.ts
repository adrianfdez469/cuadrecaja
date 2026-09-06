import { NextResponse } from "next/server";

import { QAB_SSO_NOT_CONFIGURED_LOG } from "@/constants/qabSso";
import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import {
  assertTiendaOnlineAccess,
  tiendaOnlineForbiddenResponse,
} from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { issueQabSsoLink } from "@/lib/tiendaOnline/tiendaOnlineSso";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { tiendaOnlineSsoLinkSchema } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Mints the one-time SSO link towards the QAB panel.
 *
 * POST and not GET: a GET is fired by a browser prefetch or a link scanner with
 * no human click, and if that request reaches QAB it CONSUMES the `jti`
 * (ADR 0069).
 *
 * This handler does not call `request.json()`, does not call `request.text()`
 * and does not read the query. It takes NOTHING from the caller — that is what
 * makes acceptance criterion 10 a property of the code and not of a guard.
 */
export async function POST() {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    );
    if (denial) return denial;

    const result = issueQabSsoLink({ session });

    if (result.outcome === "not_configured") {
      // The ONE line, and the only thing appended to the prefix is a member of
      // the closed reason vocabulary. Never a value, never a length, never a
      // message (E-031).
      console.error(`${QAB_SSO_NOT_CONFIGURED_LOG} ${result.reason}`);
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.ssoNotConfigured },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    if (result.outcome === "no_identity") return tiendaOnlineForbiddenResponse();

    const body = tiendaOnlineSsoLinkSchema.parse({ url: result.url });
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
