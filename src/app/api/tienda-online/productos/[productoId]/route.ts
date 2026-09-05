import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_EXTRA_PERMISOS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { QabCurrencyPayloadError } from "@/lib/qab/qabCurrencyPayload";
import { QabProductPayloadError } from "@/lib/qab/qabProductPayload";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { assertTiendaOnlineAccessAll } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  TiendaOnlineProductoNotFoundError,
  setProductoPublicacion,
} from "@/lib/tiendaOnline/tiendaOnlineProducts";
import {
  tiendaOnlineProductoUpdateResultSchema,
  tiendaOnlinePublicacionUpdateSchema,
} from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Flips the publication switch of ONE product.
 *
 * The gate demands BOTH permissions and its 403 has a single generic body: it
 * never says which of the two was missing. `axiosClient` rewrites the body of
 * any 403 anyway (E-009), so the screen tells this one apart by WHICH call
 * failed, never by reading it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ productoId: string }> },
) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccessAll(session, [
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
      TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
    ]);
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const { productoId } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      // Nothing is logged: a SyntaxError can carry a fragment of the input.
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const parsed = tiendaOnlinePublicacionUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const result = await setProductoPublicacion({
      negocioId,
      productoId,
      publicarEnTienda: parsed.data.publicarEnTienda,
      usuarioId: session.user.id,
    });

    return NextResponse.json(
      tiendaOnlineProductoUpdateResultSchema.parse(result),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof TiendaOnlineProductoNotFoundError) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.productoNotFound },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof QabProductPayloadError) {
      return NextResponse.json(
        {
          error: TIENDA_ONLINE_API_ERRORS.payloadInvalid,
          code: error.code,
          productoTiendaId: error.productoTiendaId,
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof QabCurrencyPayloadError) {
      return NextResponse.json(
        {
          error: TIENDA_ONLINE_API_ERRORS.payloadInvalid,
          code: error.code,
          productoTiendaId: null,
        },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
