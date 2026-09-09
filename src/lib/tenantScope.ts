/**
 * The tenant axis of a request: which `Negocio` the caller belongs to, and how every row a route
 * handler touches is tied back to it.
 *
 * WHEN TO USE THIS MODULE, and when one of the five that already exist:
 *
 * | If you need to...                                                        | Use                                              |
 * |--------------------------------------------------------------------------|--------------------------------------------------|
 * | Tie a store, or a row hanging off a store, to the session's business      | this module                                      |
 * | Only check that the session belongs to a `negocioId` you already have     | `assertNegocioAccess`                            |
 * | The above + the advanced configuration permission                         | `assertNegocioConfigAccess` / `...ReadAccess`    |
 * | Anything in the online store module (evaluates the switch first)          | `assertTiendaOnlineAccess` / `...All`            |
 * | Per-store scope inside the business for the order inbox                   | `resolveTiendaOnlineOrderScope` + `decideTiendaOnlineOrderManage` |
 * | A report with a date range                                                | `resolveReportScope`                             |
 *
 * Same split as `src/lib/tiendaOnline/tiendaOnlineAccess.ts`: a PURE, synchronous core that holds
 * the whole rule, and an `async` wrapper that is the only thing which touches the database.
 *
 * Exported symbols: `sessionNegocioId`, `tiendaTenantWhere`, `withTenantScope`,
 * `TENANT_SCOPE_DECISIONS`, `decideTenantScope`, `tenantForbiddenResponse`,
 * `tenantNotFoundResponse`, `tenantScopeDenial`, `assertTiendaTenant`, `resolveTenantAxis`,
 * `assertPermisoEnTienda`.
 */
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import {
  TENANT_RELATION_PATH,
  TENANT_SCOPE_API_ERRORS,
  type ITenantScopedModel,
} from "@/constants/tenantScope";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { getPermisosUsuario } from "@/utils/getPermisosUsuario";

/* ---------------------------------------------------------------- the axis */

/**
 * PURE. The tenant axis of the request: `session.user.negocio.id`, or `null`.
 *
 * It is the ONLY admitted source. Never a `negocioId` arriving in the path, the query or the body:
 * `movimiento/import` is the living counterexample — it used to take `data.negocioId` from the body
 * and validate `localId` against THAT value, which isolates nothing.
 *
 * Nor `session.user.locales`: it travels baked into the JWT since login and does not follow a later
 * assignment or revocation (E-021), exactly as `resolveTiendaOnlineOrderScope` reasons.
 */
export function sessionNegocioId(session: Session | null): string | null {
  return session?.user?.negocio?.id ?? null;
}

/* ------------------------------------------------------ the where clauses */

/**
 * PURE. The `where` that ties a `Tienda` to its business: `{ id: tiendaId, negocioId }`.
 *
 * Same shape already written by hand in `src/app/api/cierre/[tiendaId]/summary/route.ts` and in
 * `src/app/api/movimiento/[tiendaId]/caja-resumen/route.ts`.
 */
export function tiendaTenantWhere(params: {
  tiendaId: string;
  negocioId: string;
}): { id: string; negocioId: string } {
  return { id: params.tiendaId, negocioId: params.negocioId };
}

/** Whether a value is a plain object we can merge into. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== null &&
    !(value instanceof Date)
  );
}

/**
 * Deep merge where `tenant` always wins on conflict, and neither input is mutated.
 * Nobody can loosen the tenant clause from the outside.
 */
function mergeTenantClause(
  base: Record<string, unknown>,
  tenant: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };

  for (const key of Object.keys(tenant)) {
    const incoming = tenant[key];
    const current = merged[key];

    if (isPlainObject(current) && isPlainObject(incoming)) {
      merged[key] = mergeTenantClause(current, incoming);
    } else {
      merged[key] = incoming;
    }
  }

  return merged;
}

/** Builds the nested clause for a relation path: `["cierrePeriodo","tienda"]` -> nested objects. */
function buildTenantClause(
  path: readonly string[],
  negocioId: string,
): Record<string, unknown> {
  let clause: Record<string, unknown> = { negocioId };

  for (let i = path.length - 1; i >= 0; i -= 1) {
    clause = { [path[i]]: clause };
  }

  return clause;
}

/**
 * PURE. Returns `where` with the tenant clause added, nested according to
 * `TENANT_RELATION_PATH[model]`. It does NOT mutate the object it receives.
 *
 *   withTenantScope("transferDestinations", { tiendaId }, "N1")
 *     -> { tiendaId, tienda: { negocioId: "N1" } }
 *
 *   withTenantScope("cashBreakdownCierre", { cierrePeriodoId }, "N1")
 *     -> { cierrePeriodoId, cierrePeriodo: { tienda: { negocioId: "N1" } } }
 *
 *   withTenantScope("tienda", { id }, "N1")
 *     -> { id, negocioId: "N1" }
 *
 * If `where` already carries a key that collides with the first segment of the path, the objects
 * are DEEP MERGED and the tenant clause wins.
 */
export function withTenantScope<W extends object>(
  model: ITenantScopedModel,
  where: W,
  negocioId: string,
): W & Record<string, unknown> {
  const path = TENANT_RELATION_PATH[model] as readonly string[];
  const clause = buildTenantClause(path, negocioId);

  return mergeTenantClause(
    where as unknown as Record<string, unknown>,
    clause,
  ) as W & Record<string, unknown>;
}

/* ------------------------------------------------------------ the decision */

/** The four possible outcomes. */
export const TENANT_SCOPE_DECISIONS = [
  "ALLOWED",
  "NO_SESSION",
  "MISSING_PERMISSION",
  "OUT_OF_TENANT",
] as const;

export type ITenantScopeDecision = (typeof TENANT_SCOPE_DECISIONS)[number];

/**
 * PURE. THE ORDER IS THE CONTRACT, and the first one to fire wins:
 *
 *   no `negocio.id` in the session      -> NO_SESSION
 *   `permisoRequerido` and it is absent -> MISSING_PERMISSION
 *   `ownsResource === false`            -> OUT_OF_TENANT
 *   otherwise                           -> ALLOWED
 *
 * `permisoRequerido: null` means "this verb requires no permission", and DEMANDS a written reason
 * in the inventory (ADR 0078). The permission is resolved with `verificarPermisoUsuario`, which is
 * what grants it to SUPER_ADMIN from `rol`.
 *
 * ADR 0107: when a permission IS required it is checked against `permisosEnTienda` — the user's
 * permissions in the store the request addresses — and never against `session.user.permisos`,
 * which is the string computed for the user's `localActual` at login. `UsuarioTienda` carries a
 * `rolId` per store, so those two are not the same thing.
 */
export function decideTenantScope(params: {
  session: Session | null;
  permisoRequerido: string | null;
  ownsResource: boolean;
  /**
   * The user's permissions IN THE STORE this request addresses. Required
   * whenever permisoRequerido is not null; `undefined` there denies, and NEVER
   * falls back to session.user.permisos — a fallback would silently reopen the
   * very hole this closes.
   *
   * Not needed for SUPER_ADMIN, who passes on the role alone, exactly as
   * verificarPermisoUsuario already resolves it today — which is why the denial
   * goes THROUGH that function instead of short-circuiting before it.
   */
  permisosEnTienda?: string | null;
}): ITenantScopeDecision {
  const { session, permisoRequerido, ownsResource, permisosEnTienda } = params;

  if (!sessionNegocioId(session)) {
    return "NO_SESSION";
  }

  if (permisoRequerido) {
    // Failing closed is done by collapsing a missing `permisosEnTienda` to the
    // EMPTY string, never by returning before `verificarPermisoUsuario`: the
    // role shortcut lives inside that function, and a SUPER_ADMIN has no row in
    // `UsuarioTienda` for most stores, so an early return would deny them every
    // route with a permission. An empty string is not a fallback — it is "no
    // permissions in this store", which denies everyone except the role that is
    // exempt by design.
    //
    // Checked at runtime rather than expressed as a discriminated union: with
    // `strict: false` there is no narrowing by `null`, and the error would come
    // out as a TS2339 pointing at the wrong property (E-036).
    const permisos = permisosEnTienda === undefined ? "" : permisosEnTienda;
    const autorizado = verificarPermisoUsuario(
      permisos,
      permisoRequerido,
      session.user.rol,
    );
    if (!autorizado) {
      return "MISSING_PERMISSION";
    }
  }

  if (ownsResource === false) {
    return "OUT_OF_TENANT";
  }

  return "ALLOWED";
}

/* ------------------------------------------------------------ the responses */

/**
 * The body every denial of this module carries. Typed rather than left as `unknown` so a route
 * whose handler declares a narrow `NextResponse<...>` can return a denial without a cast.
 */
export type ITenantScopeError = { error: string };

/**
 * The only 403 of the module. NEVER a 401: `axiosClient` turns any 401 into a `signOut()` (E-007).
 */
export function tenantForbiddenResponse(): NextResponse<ITenantScopeError> {
  return NextResponse.json(
    { error: TENANT_SCOPE_API_ERRORS.forbidden },
    { status: 403 },
  );
}

/**
 * The only 404 of the module. "Does not exist" and "belongs to another business" answer EXACTLY the
 * same, so the route is not an oracle for the existence of foreign ids (ADR 0077).
 */
export function tenantNotFoundResponse(): NextResponse<ITenantScopeError> {
  return NextResponse.json(
    { error: TENANT_SCOPE_API_ERRORS.notFound },
    { status: 404 },
  );
}

/**
 * PURE. `null` when the decision is ALLOWED; otherwise the response to return.
 *
 * OUT_OF_TENANT is the only 404: "it does not exist" and "it belongs to another business" must be
 * indistinguishable. NO_SESSION and MISSING_PERMISSION are both 403 — never a 401, which is the
 * middleware's alone (ADR 0077), and a handler that finds no session fails closed exactly as
 * `assertTiendaOnlineAccess` already does.
 */
export function tenantScopeDenial(
  decision: ITenantScopeDecision,
): NextResponse<ITenantScopeError> | null {
  if (decision === "ALLOWED") return null;
  if (decision === "OUT_OF_TENANT") return tenantNotFoundResponse();
  return tenantForbiddenResponse();
}

/* --------------------------------------------------------- the two gates */

export type ITenantScope = { negocioId: string; tiendaId: string };

/**
 * A SINGLE object shape, not a discriminated union: `strict` is off in this project and narrowing
 * on a literal boolean does not work reliably. Same reason, and same shape, as `ReportScopeResult`.
 *
 * Callers check `scope`. When `scope` is `null`, `response` is NEVER `null`.
 */
export type ITenantScopeResult = {
  scope: ITenantScope | null;
  response: NextResponse<ITenantScopeError> | null;
};

/**
 * GATE A — when the `tiendaId` arrives in the request (path or query).
 *
 * Reads `Tienda` from the DATABASE with `tiendaTenantWhere` and `select: { id: true }`; never from
 * `session.user.locales`. A null, empty or foreign `tiendaId` returns the SAME 404.
 *
 * ORDER (ADR 0107): session (pure) -> ownership -> the user's permissions IN THAT STORE ->
 * decision. The permission used to come first because it was pure and ownership cost a query
 * (ADR 0077); now both cost a query, so that reason is gone. A foreign store answers 404 and a
 * missing permission answers 403, exactly as before for a legitimate client.
 */
export async function assertTiendaTenant(params: {
  session: Session | null;
  tiendaId: string | null | undefined;
  permisoRequerido: string | null;
}): Promise<ITenantScopeResult> {
  const { session, tiendaId, permisoRequerido } = params;

  // Session first: it is pure, and without it there is nothing to resolve against.
  const sessionDecision = decideTenantScope({
    session,
    permisoRequerido: null,
    ownsResource: true,
  });
  if (sessionDecision !== "ALLOWED") {
    return { scope: null, response: tenantScopeDenial(sessionDecision) };
  }

  const negocioId = sessionNegocioId(session);

  if (!tiendaId) {
    return { scope: null, response: tenantNotFoundResponse() };
  }

  const tienda = await prisma.tienda.findFirst({
    where: tiendaTenantWhere({ tiendaId, negocioId }),
    select: { id: true },
  });
  if (!tienda) {
    return { scope: null, response: tenantNotFoundResponse() };
  }

  // Only the call sites that actually demand a permission pay this query; the
  // ones passing `null` execute nothing new.
  const permisosEnTienda =
    permisoRequerido === null
      ? null
      : await getPermisosUsuario(session.user.id, tienda.id);

  const decision = decideTenantScope({
    session,
    permisoRequerido,
    ownsResource: true,
    permisosEnTienda,
  });
  if (decision !== "ALLOWED") {
    return { scope: null, response: tenantScopeDenial(decision) };
  }

  return { scope: { negocioId, tiendaId: tienda.id }, response: null };
}

export type ITenantAxisResult = {
  negocioId: string | null;
  response: NextResponse<ITenantScopeError> | null;
};

/**
 * GATE B, step one — when the axis does not arrive in the request and the row is addressed by its
 * own id.
 *
 * Resolves the SESSION and nothing else, and returns the `negocioId` with which the route builds
 * its query through `withTenantScope`. The route then returns `tenantNotFoundResponse()` when the
 * query yields no row: that is the same thing as "it belongs to another business", and that is the
 * point.
 *
 * It no longer takes a `permisoRequerido`, and that is deliberate (ADR 0107): here the store the
 * row belongs to is NOT known until the row has been read, so a permission checked at this point
 * could only be checked against the session's store — the very hole the ADR closes. The routes that
 * need a permission call `assertPermisoEnTienda` in step two, once their query resolved the store.
 */
export function resolveTenantAxis(params: {
  session: Session | null;
}): ITenantAxisResult {
  const { session } = params;

  const decision = decideTenantScope({
    session,
    permisoRequerido: null,
    ownsResource: true,
  });

  if (decision !== "ALLOWED") {
    return { negocioId: null, response: tenantScopeDenial(decision) };
  }

  return { negocioId: sessionNegocioId(session), response: null };
}

/**
 * GATE B, step two: the permission of a route whose store is only known once the row has been read.
 * Resolves the caller's permissions IN THAT store and decides with the same pure core as gate A.
 *
 * Returns null when allowed, and the denial response otherwise — so the caller writes
 * `if (denial) return denial;`.
 */
export async function assertPermisoEnTienda(params: {
  session: Session | null;
  tiendaId: string;
  permisoRequerido: string;
}): Promise<NextResponse<ITenantScopeError> | null> {
  const { session, tiendaId, permisoRequerido } = params;

  const permisosEnTienda = await getPermisosUsuario(
    session?.user?.id,
    tiendaId,
  );

  return tenantScopeDenial(
    decideTenantScope({
      session,
      permisoRequerido,
      ownsResource: true,
      permisosEnTienda,
    }),
  );
}
