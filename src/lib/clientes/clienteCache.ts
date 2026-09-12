import {
  clienteOptionSchema,
  type IClienteConSaldo,
  type IClienteOption,
} from "@/schemas/clienteSaldo";

/** PURE. Projects a server row down to the four fields the cache and the selector use. */
export function toClienteOption(cliente: IClienteConSaldo): IClienteOption {
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    telefono: cliente.telefono ?? null,
    saldo: Number(cliente.saldo) || 0,
  };
}

/**
 * PURE. Puts `incoming` at the front in the order given, drops earlier duplicates by `id`
 * — the incoming copy wins, so a refreshed `saldo` replaces the stale one — and truncates to
 * `size`. Neither argument is mutated.
 */
export function rememberClientes(
  current: IClienteOption[],
  incoming: IClienteOption[],
  size: number,
): IClienteOption[] {
  const cap = Number.isFinite(size) ? Math.floor(size) : 0;
  if (cap <= 0) return [];

  const head = Array.isArray(incoming) ? incoming : [];
  const tail = Array.isArray(current) ? current : [];

  const seen = new Set<string>();
  const merged: IClienteOption[] = [];

  for (const option of [...head, ...tail]) {
    if (!option || seen.has(option.id)) continue;
    seen.add(option.id);
    merged.push(option);
    if (merged.length === cap) break;
  }

  return merged;
}

/**
 * PURE. Parses each element with `clienteOptionSchema` and keeps the ones that pass,
 * truncated to `size`. Anything that is not an array yields `[]`.
 *
 * This is what a hand-written storage entry at the CURRENT version goes through: criterion 9
 * asks the screen not to break, and a version bump is not the only way to get junk in there.
 */
export function sanitizeClienteOptions(
  value: unknown,
  size: number,
): IClienteOption[] {
  if (!Array.isArray(value)) return [];

  const cap = Number.isFinite(size) ? Math.floor(size) : 0;
  if (cap <= 0) return [];

  const kept: IClienteOption[] = [];
  for (const entry of value) {
    const parsed = clienteOptionSchema.safeParse(entry);
    if (!parsed.success) continue;
    kept.push(parsed.data);
    if (kept.length === cap) break;
  }

  return kept;
}
