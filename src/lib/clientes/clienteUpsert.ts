import { prisma } from "@/lib/prisma";
import { withTenantScope } from "@/lib/tenantScope";
import { CLIENTES_UPSERT_RETRIES } from "@/constants/clientes";
import {
  normalizeClienteNombre,
  toStoredClienteText,
} from "@/lib/clientes/clienteNombre";
import { attachSaldo, loadSaldoPorCliente } from "@/lib/clientes/clienteSaldo";
import type { ICreateCliente } from "@/schemas/cliente";
import type {
  IClienteConSaldo,
  IClienteUpsertAction,
} from "@/schemas/clienteSaldo";

/** The minimum the decision needs to read from an existing row. */
export interface IClienteUpsertCandidate {
  id: string;
  deletedAt: Date | null;
}

/**
 * PURE. THE ONLY definition of the criterion-4 rule:
 *
 *   no row with that name in the business -> "CREATE"
 *   row present and soft deleted          -> "REACTIVATE"
 *   row present and active                -> "DUPLICATE"
 */
export function decideClienteUpsert(
  existing: IClienteUpsertCandidate | null,
): IClienteUpsertAction {
  if (!existing) return "CREATE";
  return existing.deletedAt ? "REACTIVATE" : "DUPLICATE";
}

/**
 * A SINGLE object shape, not a discriminated union: `strict` is off in this project, so
 * narrowing does not work reliably. Same shape and same reason as `ITenantScopeResult`.
 * When `action` is "DUPLICATE", `cliente` is null.
 */
export interface IClienteUpsertResult {
  action: IClienteUpsertAction;
  cliente: IClienteConSaldo | null;
}

/** The unique-constraint code Postgres reports through Prisma. */
const UNIQUE_VIOLATION_CODE = "P2002";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === UNIQUE_VIOLATION_CODE
  );
}

/**
 * Reads by `withTenantScope("cliente", { nombre }, negocioId)` WITHOUT filtering by
 * `deletedAt`, decides with `decideClienteUpsert`, and performs ONE write. It opens no
 * `$transaction` (ADR 0107).
 *
 * A `P2002` from that write means another request won the race between the read and the
 * write. It is retried `CLIENTES_UPSERT_RETRIES` times; on the retry the read finds the row.
 * `nombre` is passed through `normalizeClienteNombre` before both the read and the write.
 *
 * Reactivating keeps the row's `id`, sets `deletedAt` to null and writes the fields the body
 * carries. It touches no `CuentaPorCobrar`.
 */
export async function createOrReactivateCliente(params: {
  negocioId: string;
  input: ICreateCliente;
}): Promise<IClienteUpsertResult> {
  const { negocioId, input } = params;
  const nombre = normalizeClienteNombre(input.nombre);

  for (let attempt = 0; attempt <= CLIENTES_UPSERT_RETRIES; attempt += 1) {
    const existing = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { nombre }, negocioId),
      select: { id: true, deletedAt: true },
    });

    const action = decideClienteUpsert(existing);
    if (action === "DUPLICATE") {
      return { action, cliente: null };
    }

    try {
      const row =
        action === "CREATE"
          ? await prisma.cliente.create({
              data: {
                nombre,
                descripcion: toStoredClienteText(input.descripcion),
                direccion: toStoredClienteText(input.direccion),
                telefono: toStoredClienteText(input.telefono),
                negocioId,
              },
            })
          : await prisma.cliente.update({
              // The tenant clause is repeated in the write, not only in the read that
              // resolved the id: one composite `where`, never a check held in memory.
              where: withTenantScope("cliente", { id: existing.id }, negocioId),
              data: {
                nombre,
                deletedAt: null,
                // A field the body does not carry is left as it was (ADR 0107).
                ...(input.descripcion !== undefined && {
                  descripcion: toStoredClienteText(input.descripcion),
                }),
                ...(input.direccion !== undefined && {
                  direccion: toStoredClienteText(input.direccion),
                }),
                ...(input.telefono !== undefined && {
                  telefono: toStoredClienteText(input.telefono),
                }),
              },
            });

      const saldos = await loadSaldoPorCliente({
        negocioId,
        clienteIds: [row.id],
      });

      return { action, cliente: attachSaldo(row, saldos) };
    } catch (error) {
      // The only failure a retry can resolve is a lost race between the read and the write:
      // on the second pass the read finds the row and answers REACTIVATE or DUPLICATE.
      if (isUniqueViolation(error) && attempt < CLIENTES_UPSERT_RETRIES) {
        continue;
      }
      throw error;
    }
  }

  // Unreachable: the loop either returns or rethrows. It is here so the function has one
  // exit type instead of an implicit undefined.
  throw new Error("createOrReactivateCliente exhausted its retries");
}
