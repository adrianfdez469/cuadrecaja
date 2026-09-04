import { NextResponse } from "next/server";

import { TIENDA_ONLINE_API_ERRORS } from "@/constants/tiendaOnline";
import {
  isTiendaOnlineEnabled,
  tiendaOnlineForbiddenResponse,
} from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { tiendaOnlineEstadoSchema } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * The switch of the caller's OWN business, as a UI hint for the Drawer.
 *
 * The ONE exception to the module's gate: it asks for a session and nothing
 * else. `AppContext` calls it on every application start for EVERY authenticated
 * user, with or without online-store permissions, so requiring one would leave
 * the salesperson unable to know whether the section exists. And applying the
 * switch gate here would answer 403 to every disabled business on every boot,
 * which E-009 makes indistinguishable from a real permission failure.
 *
 * With the switch off it answers `200 { tiendaOnlineHabilitada: false }`.
 *
 * `negocioId` comes from the session and the route takes NO parameters. It does
 * not use `assertNegocioAccess`: that helper answers 401 when there is no
 * session, and a 401 here would trigger `signOut()` and throw the user out of
 * the application (E-007). A missing session is a 403, like everywhere else in
 * this module.
 */
export async function GET() {
  try {
    const session = await getSession();
    const negocioId = session?.user?.negocio?.id;
    if (!negocioId) return tiendaOnlineForbiddenResponse();

    const tiendaOnlineHabilitada = await isTiendaOnlineEnabled(negocioId);

    const body = tiendaOnlineEstadoSchema.parse({ tiendaOnlineHabilitada });
    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    // Only name and message: never the error object, never a Zod issues array.
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
