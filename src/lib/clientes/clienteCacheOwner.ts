/**
 * Who the persisted cliente cache belongs to.
 *
 * It exists because `CLIENTES_CACHE_STORAGE_KEY` is a global browser key and a counter tablet
 * sees several employees come and go: without this, the next user reads the name, phone and
 * debt of the previous one's clientes. ADR 0115 closed the WRITE window — the server rejects a
 * credit sale with a foreign `clienteId` — not the READ one.
 */

/** The separator of the two halves. Neither half is a uuid that can contain it. */
const OWNER_SEPARATOR = ":";

/**
 * PURE. The identity the cache belongs to: the session's user and business together.
 * Returns null when either half is missing, which is what "no session" looks like here.
 */
export function buildClienteCacheOwner(params: {
  usuarioId: string | null | undefined;
  negocioId: string | null | undefined;
}): string | null {
  const { usuarioId, negocioId } = params;
  if (!usuarioId || !negocioId) return null;
  return `${usuarioId}${OWNER_SEPARATOR}${negocioId}`;
}

/**
 * PURE. THE ONLY definition of when the persisted cache is dropped. It keeps the cache in
 * exactly one case — a stored owner that is present and equal to the current one — and drops
 * it in every other, including a stored owner of null: a cache with no recorded owner comes
 * from a build that predates this check, and there is no way to tell whose it is.
 */
export function shouldDiscardClienteCache(params: {
  storedOwner: string | null;
  currentOwner: string | null;
}): boolean {
  const { storedOwner, currentOwner } = params;
  if (!storedOwner) return true;
  return storedOwner !== currentOwner;
}
