import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { prisma } from "@/lib/prisma";
import { resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import {
  fetchQabSlugAvailability,
  isRetryableSlugCode,
} from "@/lib/qab/qabSlugClient";
import type { IQabSlugUpstreamCode } from "@/lib/qab/qabSlugClient";
import { loadQabToken } from "@/lib/qab/qabToken";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  tiendaOnlineSlugErrorSchema,
  tiendaOnlineSlugForecastSchema,
  tiendaOnlineSlugQuerySchema,
} from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

const SLUG_PARAM = "slug";
const NAME_PARAM = "name";
const TIENDA_ID_PARAM = "tiendaId";
const HTTP_BAD_GATEWAY = 502;

/**
 * Every failure of this route, as data. NO status of queandabuscando is ever
 * mirrored, not even its 503: the screen reads `qabError`, never an HTTP code
 * (ADR 0033, ADR 0034).
 */
function slugUpstream(code: IQabSlugUpstreamCode): NextResponse {
  return NextResponse.json(
    tiendaOnlineSlugErrorSchema.parse({
      error: TIENDA_ONLINE_API_ERRORS.slugUpstream,
      qabError: code,
      retryable: isRetryableSlugCode(code),
    }),
    { status: HTTP_BAD_GATEWAY, headers: NO_STORE_HEADERS },
  );
}

/** Reads a query parameter, or `undefined` when it is absent or blank. */
function readParam(request: NextRequest, name: string): string | undefined {
  const raw = request.nextUrl.searchParams.get(name);
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * What slug the merchant would end up with if they published right now.
 *
 * A FORECAST, never a reservation: its failure blocks nothing, and the screen
 * keeps the publish switch available (ADR 0033).
 *
 * Order of the checks, and no other: permission gate -> resolve `tiendaId`
 * against the business -> network. A `tiendaId` of another business never
 * reaches queandabuscando, and its 404 is identical to that of an id that does
 * not exist at all.
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

    const parsed = tiendaOnlineSlugQuerySchema.safeParse({
      slug: readParam(request, SLUG_PARAM),
      name: readParam(request, NAME_PARAM),
      tiendaId: readParam(request, TIENDA_ID_PARAM),
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const query = parsed.data;

    // Tenancy BEFORE the network, always. `Tienda` has no
    // `@@unique([id, negocioId])`, so both filters go in the same `where`.
    if (query.tiendaId !== undefined) {
      const owned = await prisma.tienda.findFirst({
        where: { id: query.tiendaId, negocioId },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { error: TIENDA_ONLINE_API_ERRORS.tiendaNotFound },
          { status: 404, headers: NO_STORE_HEADERS },
        );
      }
    }

    const baseUrl = resolveQabBaseUrl();
    if (baseUrl === null) return slugUpstream("NOT_CONFIGURED");

    const token = await loadQabToken(negocioId);
    if (token === null) return slugUpstream("NOT_CONFIGURED");

    const outcome = await fetchQabSlugAvailability({
      baseUrl,
      token,
      query: {
        slug: query.slug,
        name: query.name,
        storeId: query.tiendaId,
      },
    });

    if (outcome.kind === "error") return slugUpstream(outcome.code);

    return NextResponse.json(
      tiendaOnlineSlugForecastSchema.parse(outcome.forecast),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
