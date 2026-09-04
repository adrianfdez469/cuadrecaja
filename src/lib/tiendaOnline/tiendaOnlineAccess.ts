import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NO_STORE_HEADERS } from "@/lib/qab/qabRouteHttp";
import { TIENDA_ONLINE_API_ERRORS } from "@/constants/tiendaOnline";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

/** Why access was refused. INTERNAL: it never reaches the wire, and it is never logged. */
export type ITiendaOnlineDenialReason =
  | "NO_SESSION"
  | "MODULE_DISABLED"
  | "MISSING_PERMISSION";

export type ITiendaOnlineDecision =
  | { allowed: true; negocioId: string }
  | { allowed: false; reason: ITiendaOnlineDenialReason };

/** Explicit select, never the whole row (ADR 0019). Never names `qabToken` (ADR 0024). */
export const NEGOCIO_TIENDA_ONLINE_SWITCH_SELECT = {
  tiendaOnlineHabilitada: true,
} satisfies Prisma.NegocioSelect;

/**
 * PURE and synchronous. The whole rule of the module lives here, and this is what
 * the test suite exercises.
 *
 * ORDER IS THE CONTRACT: the switch is evaluated FIRST, before anything that looks
 * at `rol` or at `permisos`. `verificarPermisoUsuario` returns true for SUPER_ADMIN
 * on ANY permission, so a switch check placed after it would be dead code for that
 * role. See ADR 0028.
 */
export function decideTiendaOnlineAccess(params: {
  session: Session | null;
  moduleEnabled: boolean;
  permisoRequerido: string;
}): ITiendaOnlineDecision {
  const { session, moduleEnabled, permisoRequerido } = params;

  const negocioId = session?.user?.negocio?.id;
  if (!negocioId) {
    return { allowed: false, reason: "NO_SESSION" };
  }

  // FIRST, and never after the permission check: this is the only branch that
  // SUPER_ADMIN cannot walk through.
  if (moduleEnabled === false) {
    return { allowed: false, reason: "MODULE_DISABLED" };
  }

  const autorizado = verificarPermisoUsuario(
    session.user.permisos,
    permisoRequerido,
    session.user.rol,
  );
  if (!autorizado) {
    return { allowed: false, reason: "MISSING_PERMISSION" };
  }

  return { allowed: true, negocioId };
}

/**
 * Reads the switch from the DATABASE, never from the session or from x-user-*.
 * Returns false when the business does not exist: fail closed.
 */
export async function isTiendaOnlineEnabled(
  negocioId: string,
): Promise<boolean> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: negocioId },
    select: NEGOCIO_TIENDA_ONLINE_SWITCH_SELECT,
  });

  return negocio?.tiendaOnlineHabilitada === true;
}

/**
 * The single 403 of the module: same status, same body, same headers, always.
 *
 * Never a 401 — `src/lib/axiosClient.ts` turns any 401 into a `signOut()` and
 * throws the user out of the application (E-007).
 */
export function tiendaOnlineForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { error: TIENDA_ONLINE_API_ERRORS.forbidden },
    { status: 403, headers: NO_STORE_HEADERS },
  );
}

/**
 * The ONLY thing a route handler calls. Returns `null` when access is granted, or
 * the NextResponse to return when it is not. Same shape as
 * `assertNegocioConfigAccess`, deliberately.
 *
 * Never returns 401: a handler that finds no session fails closed with 403,
 * because the only 401 of the system is the middleware's (ADR 0016, E-007).
 */
export async function assertTiendaOnlineAccess(
  session: Session | null,
  permisoRequerido: string,
): Promise<NextResponse | null> {
  const negocioId = session?.user?.negocio?.id;
  if (!negocioId) return tiendaOnlineForbiddenResponse();

  const moduleEnabled = await isTiendaOnlineEnabled(negocioId);

  const decision = decideTiendaOnlineAccess({
    session,
    moduleEnabled,
    permisoRequerido,
  });

  // The three reasons collapse into the same 403: the body never says which
  // gate refused, and the reason is neither serialised nor logged.
  return decision.allowed ? null : tiendaOnlineForbiddenResponse();
}
