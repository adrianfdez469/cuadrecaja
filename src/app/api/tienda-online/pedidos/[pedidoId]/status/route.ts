import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { isQabOrderStatusRetryable } from "@/lib/qab/qabOrderStatusClient";
import type { IQabOrderStatusFailureCode } from "@/lib/qab/qabOrderStatusClient";
import { NO_STORE_HEADERS, logRouteError } from "@/lib/qab/qabRouteHttp";
import { assertTiendaOnlineAccess } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import {
  resolveTiendaOnlineOrderScope,
  tiendaOnlineOrderManageDenial,
  tiendaOnlineOrderNotFoundResponse,
} from "@/lib/tiendaOnline/tiendaOnlineOrderAccess";
import { reportTiendaOnlineOrderStatus } from "@/lib/tiendaOnline/tiendaOnlineOrderStatusReport";
import { readTiendaOnlineOrderGateTarget } from "@/lib/tiendaOnline/tiendaOnlineOrders";
import { pedidoEntranteStatusReportSchema } from "@/schemas/tiendaOnline";
import { getSession } from "@/utils/auth";

export const dynamic = "force-dynamic";

const HTTP_BAD_GATEWAY = 502;

function invalidBodyResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.invalidBody },
    { status: 400, headers: NO_STORE_HEADERS },
  );
}

/**
 * Every QAB-side outcome of the report, as data. NO status of queandabuscando is
 * ever mirrored, not even its 403 or its 404: the screen reads `qabError`, never
 * an HTTP code (ADR 0022, ADR 0064).
 *
 * `retryable` says whether the screen may offer a person the button again. The
 * server retried nothing and nothing here loops.
 */
function statusUpstreamResponse(code: IQabOrderStatusFailureCode): NextResponse {
  return NextResponse.json(
    {
      error: TIENDA_ONLINE_API_ERRORS.qabStatusUpstream,
      qabError: code,
      retryable: isQabOrderStatusRetryable(code),
    },
    { status: HTTP_BAD_GATEWAY, headers: NO_STORE_HEADERS },
  );
}

/**
 * Reports the new status of an incoming order to queandabuscando and, only if it
 * accepts, writes it locally (ADR 0063).
 *
 * The gate is the one F-011 built and this route does not reopen it: `.acceder`
 * is the module's door, the body is validated next, then BOTH gate queries run
 * in parallel with no early exit between them, and `.gestionar` is evaluated
 * against the role of the store that OWNS this order (ADR 0056).
 *
 * The ONLY 403 of this route is that permission one, with the module's single
 * FORBIDDEN body: no outcome of the other side is ever translated into a 403 of
 * ours, because `axiosClient` destroys the body of ANY 403 and the screen could
 * not tell the two meanings apart (E-009).
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

    // 3. Shape only, and the shape is the six reportable values: the other three
    //    of the contract's vocabulary end here with a 400 (ADR 0065).
    //    `parsed.error.issues` is never returned and never logged.
    const parsed = pedidoEntranteStatusReportSchema.safeParse(rawBody);
    if (!parsed.success) return invalidBodyResponse();

    // 4. BOTH queries, always both, and in parallel. There is NO early exit
    //    between them: resolving the scope only when the order shows up would
    //    make «another business's, or nonexistent» cost one query and «a store
    //    outside my scope» cost two, with the same body — two identical 404s
    //    that cost different work. This line is the mechanism of the promise
    //    that no such gap exists, not a performance detail.
    const { pedidoId } = await params;
    const [scope, target] = await Promise.all([
      resolveTiendaOnlineOrderScope({
        usuarioId: session.user.id,
        negocioId,
        rol: session.user.rol,
      }),
      readTiendaOnlineOrderGateTarget({ negocioId, pedidoId }),
    ]);

    // 5. 403, 404 or `null` to carry on. A null `target` covers «not of this
    //    business or nonexistent» and «no owning store» at once, and both leave
    //    through OUT_OF_SCOPE.
    const manageDenial = tiendaOnlineOrderManageDenial({
      session,
      scope,
      tiendaId: target?.tiendaId ?? null,
    });
    if (manageDenial) return manageDenial;
    // Unreachable: a null `target` always left through OUT_OF_SCOPE on the line
    // above. It is written so the compiler can see it, and it answers with THE
    // same 404 body, so it is not a second gate with a meaning of its own.
    if (target === null) return tiendaOnlineOrderNotFoundResponse();

    // 6. QAB first, the local row after, and nothing is written if QAB refuses.
    const report = await reportTiendaOnlineOrderStatus({
      negocioId,
      pedidoId,
      qabOrderId: target.qabOrderId,
      status: parsed.data.status,
    });

    if (report.kind === "refused") return statusUpstreamResponse(report.code);

    // 7. `persisted: false` is not an error: QAB accepted and this POS did not
    //    write it. The body says so instead of pretending (ADR 0063). It is not
    //    re-parsed: both values were produced by this route a line ago.
    return NextResponse.json(
      { status: report.status, persisted: report.persisted },
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
