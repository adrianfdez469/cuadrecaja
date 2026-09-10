import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";
import {
  CLIENTES_API_ERRORS,
  CLIENTES_PERMISO_CONFIGURACION,
} from "@/constants/clientes";
import {
  clienteInternalErrorResponse,
  isRecordNotFound,
} from "@/lib/clientes/clienteApiResponses";
import { attachSaldo, loadSaldoPorCliente } from "@/lib/clientes/clienteSaldo";
import {
  normalizeClienteNombre,
  toStoredClienteText,
} from "@/lib/clientes/clienteNombre";
import { updateClienteSchema } from "@/schemas/cliente";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/clientes/[id] — the cliente's card, with its live balance.
 *
 * No permission required, justified, same argument as the list. Not existing, belonging to
 * another business and being soft deleted answer the SAME 404 (ADR 0077): the route is not an
 * oracle for the existence of foreign ids. That is what criterion 2 verifies, and it is why
 * `deletedAt: null` is a key of the one composite `where`, not a check made afterwards.
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: null,
    });
    if (!negocioId) return response;

    const { id } = await params;

    const cliente = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { id, deletedAt: null }, negocioId),
    });
    if (!cliente) return tenantNotFoundResponse();

    const saldos = await loadSaldoPorCliente({
      negocioId,
      clienteIds: [cliente.id],
    });

    return NextResponse.json(attachSaldo(cliente, saldos));
  } catch (error) {
    return clienteInternalErrorResponse("GET /api/clientes/[id]", error);
  }
}

/**
 * PUT /api/clientes/[id] — edits the cliente.
 *
 * Order of evaluation: session and permission (`resolveTenantAxis`), then OWNERSHIP (404),
 * then the duplicate name (409). Ownership first because a request already denied should not
 * spend a query on a check it will never reach (ADR 0077).
 */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: CLIENTES_PERMISO_CONFIGURACION,
    });
    if (!negocioId) return response;

    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.cuerpoInvalido },
        { status: 400 },
      );
    }

    const parsed = updateClienteSchema.safeParse(body);
    if (!parsed.success) {
      // The Zod issues are NOT echoed: they quote the value that failed (E-031).
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.cuerpoInvalido },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const nombre =
      input.nombre === undefined
        ? undefined
        : normalizeClienteNombre(input.nombre);

    if (nombre !== undefined && nombre === "") {
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.nombreRequerido },
        { status: 400 },
      );
    }

    // Ownership, existence and "not soft deleted" in ONE composite where — never a
    // `findFirst` by id followed by an `if (row.deletedAt)` held in memory.
    const existing = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { id, deletedAt: null }, negocioId),
      select: { id: true, nombre: true },
    });
    if (!existing) return tenantNotFoundResponse();

    if (nombre !== undefined && nombre !== existing.nombre) {
      // The composite unique index counts the soft-deleted rows, so this check counts them
      // too. Renaming towards a deleted cliente's name neither reactivates nor merges it:
      // reactivation has a single path, the POST (ADR 0107).
      const duplicate = await prisma.cliente.findFirst({
        where: withTenantScope(
          "cliente",
          { nombre, id: { not: existing.id } },
          negocioId,
        ),
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: CLIENTES_API_ERRORS.nombreDuplicado },
          { status: 409 },
        );
      }
    }

    const actualizado = await prisma.cliente.update({
      // The same composite where as the read, repeated in the write.
      where: withTenantScope(
        "cliente",
        { id: existing.id, deletedAt: null },
        negocioId,
      ),
      data: {
        ...(nombre !== undefined && { nombre }),
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
      clienteIds: [actualizado.id],
    });

    return NextResponse.json(attachSaldo(actualizado, saldos));
  } catch (error) {
    // The row was soft deleted between the read and the write: the same 404 as every other
    // reason it is not there.
    if (isRecordNotFound(error)) return tenantNotFoundResponse();
    return clienteInternalErrorResponse("PUT /api/clientes/[id]", error);
  }
}

/**
 * DELETE /api/clientes/[id] — soft deletes the cliente.
 *
 * It is an UPDATE of `deletedAt`, never a row DELETE, and it touches no `CuentaPorCobrar`
 * (decided in F-029 § 2.1; F-031 only implements it). A cliente with any live account
 * (`settledAt IS NULL`) answers 409 naming the amount.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: CLIENTES_PERMISO_CONFIGURACION,
    });
    if (!negocioId) return response;

    const { id } = await params;

    const existing = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { id, deletedAt: null }, negocioId),
      select: { id: true },
    });
    if (!existing) return tenantNotFoundResponse();

    const saldos = await loadSaldoPorCliente({
      negocioId,
      clienteIds: [existing.id],
    });

    // A key is present only when the cliente has at least one live account — including one
    // whose balance is zero, which is the rule the contract writes ("tiene alguna
    // CuentaPorCobrar con settledAt IS NULL"), not "its balance is greater than zero".
    const hasLiveAccount = Object.prototype.hasOwnProperty.call(
      saldos,
      existing.id,
    );
    if (hasLiveAccount) {
      const saldoPendiente = saldos[existing.id] ?? 0;
      // The figure in the message and the one in the field are the SAME reading, not two.
      return NextResponse.json(
        {
          error: CLIENTES_API_ERRORS.saldoPendiente(saldoPendiente),
          saldoPendiente,
        },
        { status: 409 },
      );
    }

    const desactivado = await prisma.cliente.update({
      where: withTenantScope(
        "cliente",
        { id: existing.id, deletedAt: null },
        negocioId,
      ),
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(desactivado);
  } catch (error) {
    if (isRecordNotFound(error)) return tenantNotFoundResponse();
    return clienteInternalErrorResponse("DELETE /api/clientes/[id]", error);
  }
}
