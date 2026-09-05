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
  TiendaOnlineBulkTooLargeError,
  TiendaOnlineCategoriaNotFoundError,
  setCategoriaPublicacionMasiva,
} from "@/lib/tiendaOnline/tiendaOnlineProducts";
import {
  tiendaOnlineBulkResultSchema,
  tiendaOnlinePublicacionUpdateSchema,
} from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * Publishes (or unpublishes) every product of ONE category, all or nothing.
 *
 * The tenant filter lives on `Producto`, inside the domain function, in the same
 * query that decides what is touched — never on `Categoria`, whose `negocioId`
 * is legitimately null for a global one.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoriaId: string }> },
) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccessAll(session, [
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
      TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
    ]);
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const { categoriaId } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
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

    const result = await setCategoriaPublicacionMasiva({
      negocioId,
      categoriaId,
      publicarEnTienda: parsed.data.publicarEnTienda,
      usuarioId: session.user.id,
    });

    return NextResponse.json(tiendaOnlineBulkResultSchema.parse(result), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof TiendaOnlineCategoriaNotFoundError) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.categoriaNotFound },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof TiendaOnlineBulkTooLargeError) {
      return NextResponse.json(
        {
          error: TIENDA_ONLINE_API_ERRORS.bulkTooLarge,
          productos: error.productos,
          max: error.max,
        },
        { status: 409, headers: NO_STORE_HEADERS },
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
