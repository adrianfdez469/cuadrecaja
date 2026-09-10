import type { IClienteOption } from "@/schemas/clienteSaldo";

export const CLIENTE_SEARCH_SOURCES = ["server", "cache"] as const;
export type IClienteSearchSource = (typeof CLIENTE_SEARCH_SOURCES)[number];

export const CLIENTE_CREATE_BLOCK_REASONS = ["sin-permiso", "offline"] as const;
export type IClienteCreateBlockReason =
  (typeof CLIENTE_CREATE_BLOCK_REASONS)[number];

/**
 * PURE. Case-insensitive substring over `nombre` only — the same field and the same
 * comparison the server does with `contains` + `mode: "insensitive"`, so online and offline
 * results answer the same question. It is not accent-insensitive on either side.
 */
export function matchesClienteTerm(
  option: IClienteOption,
  term: string,
): boolean {
  const needle = typeof term === "string" ? term.toLowerCase() : "";
  const haystack =
    option && typeof option.nombre === "string"
      ? option.nombre.toLowerCase()
      : "";
  return haystack.includes(needle);
}

/**
 * PURE. The options matching `term`, in the order they are stored, capped at `limit`.
 * An empty or whitespace-only `term` yields the first `limit` options.
 */
export function filterClientesCache(
  options: IClienteOption[],
  term: string,
  limit: number,
): IClienteOption[] {
  const list = Array.isArray(options) ? options : [];
  const cap = Number.isFinite(limit) ? Math.floor(limit) : 0;
  if (cap <= 0) return [];

  const trimmed = typeof term === "string" ? term.trim() : "";
  if (trimmed === "") return list.slice(0, cap);

  return list.filter((option) => matchesClienteTerm(option, term)).slice(0, cap);
}

/**
 * PURE. THE ORDER IS THE CONTRACT, and the first one to fire wins:
 *
 *   no permission -> "sin-permiso"
 *   offline       -> "offline"
 *   otherwise     -> canCreate true, blockReason null
 *
 * Permission first for the same reason as `decideTenantScope`: it is the more restrictive of
 * the two answers, and it does not change when the connection comes back.
 */
export function resolveCreateAvailability(params: {
  isOnline: boolean;
  hasPermission: boolean;
}): { canCreate: boolean; blockReason: IClienteCreateBlockReason | null } {
  if (!params.hasPermission) {
    return { canCreate: false, blockReason: "sin-permiso" };
  }
  if (!params.isOnline) {
    return { canCreate: false, blockReason: "offline" };
  }
  return { canCreate: true, blockReason: null };
}
