import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_EXTRA_PERMISOS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import {
  assertTiendaOnlineAccess,
  hasTiendaOnlinePermisos,
} from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { listTiendaOnlineProductos } from "@/lib/tiendaOnline/tiendaOnlineProducts";
import {
  tiendaOnlineProductosPageSchema,
  tiendaOnlineProductosQuerySchema,
} from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

/**
 * The product listing of the publishing tab.
 *
 * The gate is the module's own: `tiendaonline.configuracion.acceder` SEES the
 * tab. Acting on it needs `operaciones.inventario.acceder` too, and that second
 * permission only reaches this response as `puedePublicar` — a convenience for
 * the screen, never the boundary: the two PATCHes re-check it server side.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed = tiendaOnlineProductosQuerySchema.safeParse(raw);
    if (!parsed.success) {
      // Never `parsed.error.issues`: those drag fragments of the input along.
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const page = await listTiendaOnlineProductos({
      negocioId,
      categoriaId: parsed.data.categoriaId,
      search: parsed.data.search,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
      puedePublicar: hasTiendaOnlinePermisos(session, [
        TIENDA_ONLINE_PERMISOS.configuracionAcceder,
        TIENDA_ONLINE_EXTRA_PERMISOS.inventarioAcceder,
      ]),
    });

    return NextResponse.json(tiendaOnlineProductosPageSchema.parse(page), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
