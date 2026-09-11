import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  assertPermisoEnNegocio,
  resolveTenantAxis,
  withTenantScope,
} from "@/lib/tenantScope";
import {
  CLIENTES_API_ERRORS,
  CLIENTES_LIST_LIMIT,
  CLIENTES_PERMISO_CONFIGURACION,
} from "@/constants/clientes";
import { clienteInternalErrorResponse } from "@/lib/clientes/clienteApiResponses";
import { attachSaldo, loadSaldoPorCliente } from "@/lib/clientes/clienteSaldo";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import { createOrReactivateCliente } from "@/lib/clientes/clienteUpsert";
import { createClienteSchema } from "@/schemas/cliente";

/**
 * Bounds `limit` at the edge instead of letting `Number(...)` decide by accident: a missing,
 * non-numeric, zero or negative value falls back to the ceiling, and nothing above it passes.
 */
function resolveListLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return CLIENTES_LIST_LIMIT;
  return Math.min(Math.floor(parsed), CLIENTES_LIST_LIMIT);
}

/**
 * GET /api/clientes — the active clientes of the business, each with its live balance.
 *
 * No permission required, justified: the list is read by every user of the business because
 * the selector needs it. The `saldo` field travels without a permission ON PURPOSE (contract
 * § 5.1): whoever is about to extend credit needs to know what the cliente already owes.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({ session });
    if (!negocioId) return response;

    const { searchParams } = new URL(request.url);
    const nombre = searchParams.get("nombre");
    const take = resolveListLimit(searchParams.get("limit"));

    const clientes = await prisma.cliente.findMany({
      where: withTenantScope(
        "cliente",
        {
          deletedAt: null,
          ...(nombre
            ? { nombre: { contains: nombre, mode: "insensitive" as const } }
            : {}),
        },
        negocioId,
      ),
      orderBy: { nombre: "asc" },
      take,
    });

    // Two queries per request whatever the number of clientes: this findMany and the
    // groupBy inside loadSaldoPorCliente. No Promise.all over the rows.
    const saldos = await loadSaldoPorCliente({
      negocioId,
      clienteIds: clientes.map((cliente) => cliente.id),
    });

    return NextResponse.json(
      clientes.map((cliente) => attachSaldo(cliente, saldos)),
    );
  } catch (error) {
    return clienteInternalErrorResponse("GET /api/clientes", error);
  }
}

/**
 * POST /api/clientes — creates a cliente, or REACTIVATES the soft-deleted row that already
 * holds that name (criterion 4, ADR 0114). Both successes answer 201 and the difference
 * travels in `action`: a state signal that has to be inferred is E-013.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({ session });
    if (!negocioId) return response;

    // Business-scoped resource: no single store bounds it, so the gate uses the
    // permissions the session carries. See assertPermisoEnNegocio.
    const denial = assertPermisoEnNegocio({
      session,
      permisoRequerido: CLIENTES_PERMISO_CONFIGURACION,
    });
    if (denial) return denial;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.cuerpoInvalido },
        { status: 400 },
      );
    }

    const parsed = createClienteSchema.safeParse(body);
    if (!parsed.success) {
      // The Zod issues are NOT echoed: they quote the value that failed (E-031).
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.cuerpoInvalido },
        { status: 400 },
      );
    }

    if (normalizeClienteNombre(parsed.data.nombre) === "") {
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.nombreRequerido },
        { status: 400 },
      );
    }

    const result = await createOrReactivateCliente({
      negocioId,
      input: parsed.data,
    });

    if (result.action === "DUPLICATE") {
      return NextResponse.json(
        { error: CLIENTES_API_ERRORS.nombreDuplicado },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { action: result.action, cliente: result.cliente },
      { status: 201 },
    );
  } catch (error) {
    return clienteInternalErrorResponse("POST /api/clientes", error);
  }
}
