import { NextResponse } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  manageableTiendaIds,
  resolveTiendaOnlineOrderScope,
  tiendaOnlineOrderNotFoundResponse,
} from "@/lib/tiendaOnline/tiendaOnlineOrderAccess";
import { getTiendaOnlineOrderDetail } from "@/lib/tiendaOnline/tiendaOnlineOrders";
import { tiendaOnlineOrderDetailSchema } from "@/schemas/tiendaOnline";
import type { ITiendaOnlineOrderDetail } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

function internalErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.internal },
    { status: 500, headers: NO_STORE_HEADERS },
  );
}

/**
 * One order of the inbox, with its lines.
 *
 * The cost here is already constant, and it is worth saying why so that nobody
 * "optimises" it: the three reasons for the 404 — the order does not exist, it
 * belongs to another business, or its store is out of scope — are resolved by
 * ONE query, because the `where` carries the three filters together. The route
 * always makes two round trips: the scope and the order.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const scope = await resolveTiendaOnlineOrderScope({
      usuarioId: session.user.id,
      negocioId,
      rol: session.user.rol,
    });

    const { pedidoId } = await params;
    const payload = await getTiendaOnlineOrderDetail({
      negocioId,
      pedidoId,
      tiendaIds: scope.tiendaIds,
      manageableTiendaIds: manageableTiendaIds(session, scope),
    });
    // The same function the PATCH calls: one author for this body (E-014).
    if (payload === null) return tiendaOnlineOrderNotFoundResponse();

    let body: ITiendaOnlineOrderDetail;
    try {
      body = tiendaOnlineOrderDetailSchema.parse(payload);
    } catch {
      // A fixed constant, never the ZodError (ADR 0061, E-031).
      console.error(TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG);
      return internalErrorResponse();
    }

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logRouteError(error);
    return internalErrorResponse();
  }
}
