import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";

import {
  TIENDA_ONLINE_API_ERRORS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { prisma } from "@/lib/prisma";
import { NO_STORE_HEADERS } from "@/lib/qab/qabRouteHttp";
import { tiendaOnlineForbiddenResponse } from "@/lib/tiendaOnline/tiendaOnlineAccess";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import { roles } from "@/utils/roles";

/**
 * The store axis of the orders inbox (ADR 0056).
 *
 * `tiendaOnlineAccess.ts` is NOT modified: F-005 and F-006 consume it and have
 * already verified it. `.acceder` stays the module's door, evaluated once
 * against the session; `.gestionar` is evaluated here, against the role of the
 * `UsuarioTienda` row of the store that OWNS the order.
 */

/**
 * What one session may reach inside ONE business, store by store.
 *
 * `tiendaIds` is the set the listing filters by (criteria 1 and 2), sorted and
 * deduplicated. Empty is legal and is not a denial.
 *
 * `permisos` has exactly the same keys as `tiendaIds`: each maps to the
 * `Rol.permisos` string of the session's `UsuarioTienda` row for that store,
 * `""` when the row carries no role, and `""` for every entry of a SUPER_ADMIN,
 * who holds no `UsuarioTienda` row and whose permissions come from `rol` alone
 * through `verificarPermisoUsuario`.
 */
export interface ITiendaOnlineOrderScope {
  tiendaIds: string[];
  permisos: Record<string, string>;
}

/** Explicit select, never the whole row (ADR 0013, ADR 0019). */
export const USUARIO_TIENDA_SCOPE_SELECT = {
  tiendaId: true,
  rol: { select: { permisos: true } },
} satisfies Prisma.UsuarioTiendaSelect;

/** The scope of a SUPER_ADMIN: every store of the business, no role string. */
async function resolveSuperAdminScope(
  negocioId: string,
): Promise<ITiendaOnlineOrderScope> {
  const tiendas = await prisma.tienda.findMany({
    where: { negocioId },
    select: { id: true },
  });
  return buildScope(tiendas.map((tienda) => ({ tiendaId: tienda.id, permisos: "" })));
}

/** Sorted, deduplicated, and with `permisos` keyed by exactly the same ids. */
function buildScope(
  rows: Array<{ tiendaId: string; permisos: string }>,
): ITiendaOnlineOrderScope {
  const permisos: Record<string, string> = {};
  for (const row of rows) permisos[row.tiendaId] = row.permisos;
  return { tiendaIds: Object.keys(permisos).sort(), permisos };
}

/**
 * Reads the scope from the DATABASE, never from `session.user.locales`: that
 * array is baked into the JWT at login and does not follow an assignment or a
 * revocation made afterwards (E-021), which is not good enough for an
 * authorisation decision.
 *
 * The tenancy filter is `tienda: { negocioId }`: a `UsuarioTienda` row pointing
 * at a store of ANOTHER business never enters the set, whatever its id.
 *
 * SUPER_ADMIN resolves to every `Tienda` of `negocioId` — the same set
 * `authOptions` builds for that role when it fills `locales` — each with `""`.
 */
export async function resolveTiendaOnlineOrderScope(params: {
  usuarioId: string;
  negocioId: string;
  rol: string;
}): Promise<ITiendaOnlineOrderScope> {
  const { usuarioId, negocioId, rol } = params;

  if (rol === roles.SUPER_ADMIN) return resolveSuperAdminScope(negocioId);

  const asignaciones = await prisma.usuarioTienda.findMany({
    where: { usuarioId, tienda: { negocioId } },
    select: USUARIO_TIENDA_SCOPE_SELECT,
  });

  return buildScope(
    asignaciones.map((asignacion) => ({
      tiendaId: asignacion.tiendaId,
      permisos: asignacion.rol?.permisos ?? "",
    })),
  );
}

/** The three outcomes of the manage gate. */
export const TIENDA_ONLINE_ORDER_MANAGE_DECISIONS = [
  "ALLOWED",
  "FORBIDDEN",
  "OUT_OF_SCOPE",
] as const;
export type ITiendaOnlineOrderManageDecision =
  (typeof TIENDA_ONLINE_ORDER_MANAGE_DECISIONS)[number];

/**
 * PURE. Whether this session may ACT on an order owned by `tiendaId`.
 *
 * Evaluated in THIS order, and the first match wins:
 *
 *   session === null                    -> FORBIDDEN   (fails closed; the door
 *                                          already refuses this case, and it is
 *                                          coded anyway for the same reason
 *                                          `decideTiendaOnlineAccess` codes
 *                                          NO_SESSION)
 *   tiendaId === null                   -> OUT_OF_SCOPE
 *   tiendaId not in scope.tiendaIds     -> OUT_OF_SCOPE
 *   no `.gestionar` in that store       -> FORBIDDEN
 *   otherwise                           -> ALLOWED
 *
 * The permission is resolved with `verificarPermisoUsuario`, which is what
 * grants it to SUPER_ADMIN from `rol` alone.
 *
 * It does NOT re-read the switch: the module door already did, first and before
 * anything that looks at `rol` or `permisos` (ADR 0028). Because of that, this
 * function is NOT a gate on its own and no route may use it as one.
 */
export function decideTiendaOnlineOrderManage(params: {
  session: Session | null;
  scope: ITiendaOnlineOrderScope;
  tiendaId: string | null;
}): ITiendaOnlineOrderManageDecision {
  const { session, scope, tiendaId } = params;

  if (session === null) return "FORBIDDEN";
  if (tiendaId === null) return "OUT_OF_SCOPE";
  if (!scope.tiendaIds.includes(tiendaId)) return "OUT_OF_SCOPE";

  const autorizado = verificarPermisoUsuario(
    scope.permisos[tiendaId] ?? "",
    TIENDA_ONLINE_PERMISOS.pedidosGestionar,
    session.user.rol,
  );

  return autorizado ? "ALLOWED" : "FORBIDDEN";
}

/**
 * PURE. The subset of `scope.tiendaIds` where this session holds `.gestionar`,
 * obtained by asking `decideTiendaOnlineOrderManage` about each one — so there is
 * no second, paraphrased copy of the rule.
 *
 * Feeds `canManage` of every row. Convenience for the UI, NOT the boundary.
 */
export function manageableTiendaIds(
  session: Session | null,
  scope: ITiendaOnlineOrderScope,
): Set<string> {
  const allowed = new Set<string>();
  for (const tiendaId of scope.tiendaIds) {
    if (decideTiendaOnlineOrderManage({ session, scope, tiendaId }) === "ALLOWED") {
      allowed.add(tiendaId);
    }
  }
  return allowed;
}

/**
 * THE 404 of the two routes addressed by `pedidoId`, and the only place its body
 * is written. Same status, same body, same headers, for all four reasons an
 * order can be out of reach.
 *
 * No route handler writes
 * `NextResponse.json({ error: TIENDA_ONLINE_API_ERRORS.pedidoNotFound }, ...)`
 * by hand: two 404 bodies written apart drift in their headers or their shape the
 * first time somebody touches one (E-014). Same reasoning as
 * `tiendaOnlineForbiddenResponse()` in F-004.
 */
export function tiendaOnlineOrderNotFoundResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.pedidoNotFound },
    { status: 404, headers: NO_STORE_HEADERS },
  );
}

/**
 * The only thing the PATCH calls after resolving the owner: `null` when the
 * decision is ALLOWED, the response to return otherwise.
 *
 * NOT async — the scope is already resolved. FORBIDDEN maps to the module's one
 * and only `tiendaOnlineForbiddenResponse()`, OUT_OF_SCOPE to
 * `tiendaOnlineOrderNotFoundResponse()`.
 */
export function tiendaOnlineOrderManageDenial(params: {
  session: Session | null;
  scope: ITiendaOnlineOrderScope;
  tiendaId: string | null;
}): NextResponse | null {
  const decision = decideTiendaOnlineOrderManage(params);
  if (decision === "ALLOWED") return null;
  if (decision === "FORBIDDEN") return tiendaOnlineForbiddenResponse();
  return tiendaOnlineOrderNotFoundResponse();
}
