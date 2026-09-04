import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { z } from "zod";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { QabStorePayloadError } from "@/lib/qab/qabStorePayload";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  TiendaOnlineAlmacenError,
  TiendaOnlineNotFoundError,
  TiendaOnlineOpeningHoursError,
  saveTiendaOnlineLocal,
} from "@/lib/tiendaOnline/tiendaOnlineStore";
import { collectOpeningHoursIssues } from "@/schemas/qabOpeningHours";
import type { IOpeningHoursIssue } from "@/schemas/qabOpeningHours";
import {
  tiendaOnlineLocalUpdateResultSchema,
  tiendaOnlineLocalUpdateSchema,
} from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

const HORARIOS_KEY = "horarios";

function invalidBody(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

function openingHoursInvalid(issues: IOpeningHoursIssue[]): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.openingHoursInvalid, issues },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

/**
 * `true` when EVERY Zod issue hangs off `horarios`.
 *
 * The exception to F-004's «never return `parsed.error.issues`» rule is
 * deliberate and narrow: what travels is NOT Zod's issues — those drag
 * fragments of the input along — but our own closed vocabulary, a `code` of
 * QAB_OPENING_HOURS_ISSUE_CODES plus a `path` of keys we define. Without it
 * acceptance criterion 8 is unreachable from the server.
 */
function onlyOpeningHoursFailed(error: z.ZodError): boolean {
  return (
    error.issues.length > 0 &&
    error.issues.every((issue) => issue.path[0] === HORARIOS_KEY)
  );
}

function readHorarios(body: unknown): unknown {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return undefined;
  }
  return (body as Record<string, unknown>)[HORARIOS_KEY];
}

/**
 * Full replacement of one local's online-store block, plus the STORE event.
 *
 * The order of the checks IS the contract: the permission gate runs before the
 * body is read and before the database is touched, so the 403 is identical
 * whether the local exists or not.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string }> },
) {
  try {
    const session = await getSession();
    const denial = await assertTiendaOnlineAccess(
      session,
      TIENDA_ONLINE_PERMISOS.configuracionAcceder,
    );
    if (denial) return denial;
    const negocioId = session.user.negocio.id; // the ONLY source of negocioId

    const { tiendaId } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      // Nothing is logged: a SyntaxError can carry a fragment of the input.
      return invalidBody();
    }

    const parsed = tiendaOnlineLocalUpdateSchema.safeParse(rawBody);
    if (!parsed.success) {
      if (onlyOpeningHoursFailed(parsed.error)) {
        return openingHoursInvalid(
          collectOpeningHoursIssues(readHorarios(rawBody)),
        );
      }
      return invalidBody();
    }

    const result = await saveTiendaOnlineLocal({
      negocioId,
      tiendaId,
      input: parsed.data,
      usuarioId: session.user.id,
    });

    return NextResponse.json(
      tiendaOnlineLocalUpdateResultSchema.parse(result),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof TiendaOnlineNotFoundError) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.tiendaNotFound },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof TiendaOnlineAlmacenError) {
      return NextResponse.json(
        { error: TIENDA_ONLINE_API_ERRORS.almacenNotPublishable },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (
      error instanceof TiendaOnlineOpeningHoursError ||
      error instanceof QabStorePayloadError
    ) {
      return openingHoursInvalid(error.issues);
    }

    logRouteError(error);
    return NextResponse.json(
      { error: TIENDA_ONLINE_API_ERRORS.internal },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
