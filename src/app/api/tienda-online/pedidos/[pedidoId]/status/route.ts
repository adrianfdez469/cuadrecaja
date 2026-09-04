import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { prisma } from "@/lib/prisma";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
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
 * It applies the third gate (`tiendaonline.pedidos.gestionar`, NOT `.acceder`),
 * validates the shape of the body, resolves the order through the composite key
 * so the tenancy filter cannot be forgotten, and answers `501 NOT_IMPLEMENTED`
 * WITHOUT WRITING ANYTHING (ADR 0030): writing a status without the transition
 * validation and without telling QAB would desynchronise both systems, and that
 * is precisely what F-011 exists to design.
 *
 * The 403/501 pair is the observable proof that the gate ran first: a user with
 * `.acceder` and without `.gestionar` gets 403 on the very same order that
 * answers 501 to a user who has `.gestionar`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pedidoId: string }> },
) {
  try {
    // 1. The gate, before reading the body and before touching the database, so
    //    that the 403 is the same whether or not the order exists.
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.pedidosGestionar,
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

    // 4. Tenancy filter INSIDE the key: an order of another business and an
    //    order that does not exist are indistinguishable already at the query,
    //    so there is no existence oracle.
    const { pedidoId } = await params;
    const pedido = await prisma.pedidoEntrante.findUnique({
      where: { id_negocioId: { id: pedidoId, negocioId } },
      select: { id: true },
    });
    if (!pedido) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.pedidoNotFound },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    // 5. No write. F-011 owns the real transition.
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
