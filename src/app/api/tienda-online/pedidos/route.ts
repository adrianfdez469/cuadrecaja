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
 * Scaffolding of the incoming-orders screen.
 *
 * Gate: switch + `tiendaonline.pedidos.acceder`. It deliberately returns NO
 * orders: F-011 builds the real listing with its pagination, and an unpaginated
 * listing over a table that grows without bound is exactly the precedent not to
 * leave written down.
 */
export async function GET() {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    // Inside the try: see the sibling configuration route.
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
