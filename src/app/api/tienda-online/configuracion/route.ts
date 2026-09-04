import { NextResponse } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { tiendaOnlineScaffoldSchema } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Scaffolding of the online-store configuration screen.
 *
 * Gate: switch + `tiendaonline.configuracion.acceder`, in that order, through
 * the module's guard. F-005 replaces the body; the route and the gate stay.
 */
export async function GET() {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    // Inside the try on purpose: the `z.literal(true)` is a canary. If the gate
    // ever let a disabled business through, this throws and degrades to the
    // generic 500 instead of answering a lie.
    const body = tiendaOnlineScaffoldSchema.parse({
      negocioId,
      tiendaOnlineHabilitada: true,
    });

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
