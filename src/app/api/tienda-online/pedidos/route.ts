import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
} from "@/lib/tiendaOnline/tiendaOnlineOrderAccess";
import { listTiendaOnlineOrders } from "@/lib/tiendaOnline/tiendaOnlineOrders";
import {
  tiendaOnlineOrdersPageSchema,
  tiendaOnlineOrdersQuerySchema,
} from "@/schemas/tiendaOnline";
import type { ITiendaOnlineOrdersPage } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

function internalErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.internal },
    { status: 500, headers: NO_STORE_HEADERS },
  );
}

/**
 * One page of the orders inbox, plus the two counters.
 *
 * The door is `tiendaonline.pedidos.acceder`, evaluated ONCE against the session
 * and with the switch first (ADR 0028). WHICH orders come back is not decided by
 * any permission: it is decided by `UsuarioTienda` membership, read from the
 * database (ADR 0056, E-021).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const parsed = tiendaOnlineOrdersQuerySchema.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      // Never `parsed.error.issues`: those drag fragments of the input along.
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const scope = await resolveTiendaOnlineOrderScope({
      usuarioId: session.user.id,
      negocioId,
      rol: session.user.rol,
    });

    const payload = await listTiendaOnlineOrders({
      negocioId,
      tiendaIds: scope.tiendaIds,
      manageableTiendaIds: manageableTiendaIds(session, scope),
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });

    // The parse stays because it is the canary of the scaffold's
    // `z.literal(true)`. What is logged when it fails is a FIXED constant and
    // never the ZodError: its `message` serialises issues that can carry values
    // of the validated row, `Order.code` among them (ADR 0061, E-031).
    let body: ITiendaOnlineOrdersPage;
    try {
      body = tiendaOnlineOrdersPageSchema.parse(payload);
    } catch {
      console.error(TIENDA_ONLINE_ORDER_RESPONSE_INVALID_LOG);
      return internalErrorResponse();
    }

    return NextResponse.json(body, { headers: NO_STORE_HEADERS });
  } catch (error) {
    logRouteError(error);
    return internalErrorResponse();
  }
}
