import type { Session } from "next-auth";
import { TipoLocal } from "@/schemas/tienda";
import type { ILocal } from "@/schemas/tienda";
import type { IQabSsoClaims } from "@/schemas/qabSso";

/**
 * PURE. The store ids the assertion may carry.
 *
 * TWO conditions joined by AND, and both are implemented (E-032). A local's `id`
 * is included if and only if:
 *
 *   1. `local.negocioId === businessId`, and
 *   2. `local.tipo === TipoLocal.TIENDA`.
 *
 * Order of appearance is preserved and duplicates are dropped keeping the FIRST
 * occurrence. A `null` or `undefined` list yields `[]`.
 *
 * Condition 1 is defence in depth and not an expectation: `authOptions` already
 * scopes `locales` to the user's own business, so today it drops nothing. It is
 * written because `businessId` and `storeIds` ARE the boundary between tenants
 * inside the token.
 *
 * Condition 2 is not cosmetic: an ALMACEN can never become a QAB `Store`
 * (`slugLearn.ts` filters by TIENDA, `setTiendaOnlinePublicacion` refuses it), so
 * its id is an identifier that corresponds to nothing on the other side.
 *
 * An empty result is a valid result: see `buildQabSsoClaims`. See ADR 0067.
 */
export function selectQabSsoStoreIds(
  locales: ILocal[] | null | undefined,
  businessId: string,
): string[] {
  if (locales === null || locales === undefined) return [];

  const seen = new Set<string>();
  const storeIds: string[] = [];

  for (const local of locales) {
    if (local.negocioId !== businessId) continue;
    if (local.tipo !== TipoLocal.TIENDA) continue;
    if (seen.has(local.id)) continue;
    seen.add(local.id);
    storeIds.push(local.id);
  }

  return storeIds;
}

/** Trimmed, or the empty string when the field is absent. */
function trimmed(value: string | null | undefined): string {
  return value === null || value === undefined ? "" : value.trim();
}

/**
 * PURE. The six claims, read from the session and from nowhere else. No database
 * access, here or anywhere else in the emission path.
 *
 * Returns `null` — "this session cannot assert an identity" — when ANY of these
 * four is missing or blank after trimming:
 *
 *   session.user.id  |  session.user.nombre  |  session.user.usuario  |  session.user.negocio.id
 *
 * and only then. An EMPTY `storeIds` is NOT one of those cases: cuadrecaja does
 * not model QAB's access rules, and an assertion with no stores is an identity
 * without stores, not an error.
 *
 * The four string fields are trimmed, and the claim carries the TRIMMED value.
 *
 * `email` is `session.user.usuario`. The `Usuario` model has no `email` column:
 * `usuario` is what holds the address — `POST /api/usuarios` validates it with
 * EMAIL_REGEX and the invite and reset flows pass it as the recipient. ADR 0067.
 */
export function buildQabSsoClaims(params: {
  session: Session | null;
  jti: string;
}): IQabSsoClaims | null {
  const { session, jti } = params;
  const user = session?.user;

  const sub = trimmed(user?.id);
  const name = trimmed(user?.nombre);
  const email = trimmed(user?.usuario);
  const businessId = trimmed(user?.negocio?.id);

  if (
    sub.length === 0 ||
    name.length === 0 ||
    email.length === 0 ||
    businessId.length === 0
  ) {
    return null;
  }

  return {
    jti,
    sub,
    name,
    email,
    businessId,
    storeIds: selectQabSsoStoreIds(user.locales, businessId),
  };
}
