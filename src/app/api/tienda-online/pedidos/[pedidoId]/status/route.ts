import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  resolveTiendaOnlineOrderScope,
  tiendaOnlineOrderManageDenial,
} from "@/lib/tiendaOnline/tiendaOnlineOrderAccess";
import { readTiendaOnlineOrderTiendaId } from "@/lib/tiendaOnline/tiendaOnlineOrders";
import { pedidoEntranteStatusUpdateSchema } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

function invalidBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

/**
 * Changes the status of an incoming order — except it does not, yet.
 *
 * It answers `501 NOT_IMPLEMENTED` WITHOUT WRITING ANYTHING (ADR 0030): writing
 * a status without the transition validation and without telling QAB would
 * desynchronise both systems, and that is F-012's work.
 *
 * What F-011 changes here is only the gate. The module's door is `.acceder`, the
 * same as the two GETs; `.gestionar` is then evaluated against the role of the
 * `UsuarioTienda` row of the store that OWNS this order, not against the store
 * that happens to be active in the session (ADR 0056).
 *
 * The 403/501 pair is still observable, and now the 404/501 pair is too: the
 * same `pedidoId` answers 501 to the user holding `.gestionar` in the owning
 * store, 403 to the one assigned to that store without the permission, and 404
 * to the one who is not assigned to it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  try {
    // 1. The door, before reading the body and before touching the order.
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.pedidosAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    // 2. A SyntaxError here drags a fragment of the input along: it is not logged.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return invalidBodyResponse();
    }

    // 3. Shape only. `parsed.error.issues` is never returned and never logged.
    const parsed = pedidoEntranteStatusUpdateSchema.safeParse(rawBody);
    if (!parsed.success) return invalidBodyResponse();

    // 4. BOTH queries, always both, and in parallel. There is NO early exit
    //    between them: resolving the scope only when the order shows up would
    //    make «another business's, or nonexistent» cost one query and «a store
    //    outside my scope» cost two, with the same body — two identical 404s
    //    that cost different work. This line is the mechanism of the promise
    //    that no such gap exists, not a performance detail.
    const { pedidoId } = await params;
    const [scope, tiendaId] = await Promise.all([
      resolveTiendaOnlineOrderScope({
        usuarioId: session.user.id,
        negocioId,
        rol: session.user.rol,
      }),
      readTiendaOnlineOrderTiendaId({ negocioId, pedidoId }),
    ]);

    // 5. 403, 404 or `null` to carry on. `tiendaId === null` covers «not of this
    //    business or nonexistent» and «no owning store» at once, and both leave
    //    through OUT_OF_SCOPE.
    const manageDenial = tiendaOnlineOrderManageDenial({
      session,
      scope,
      tiendaId,
    });
    if (manageDenial) return manageDenial;

    // 6. No write. F-012 owns the real transition.
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.notImplemented },
      { status: 501, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
