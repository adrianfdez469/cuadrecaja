import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { billCountSchema } from "@/schemas/billBreakdown";
import { z } from "zod";
import {
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";

const putBodySchema = z.object({
  items: z.array(billCountSchema),
  total: z.number().min(0),
});

/** `tiendaId` was missing here even though the segment exists in the path; F-021 adds it. */
type Params = { tiendaId: string; cierreId: string; monedaCode: string };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { cierreId, monedaCode } = await params;

    // F-021, gate B. No permission — counting the drawer is part of the cashier flow (ADR 0078).
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: null,
    });
    if (!negocioId) return response;

    const breakdown = await prisma.cashBreakdownMoneda.findFirst({
      where: withTenantScope(
        "cashBreakdownMoneda",
        { cierrePeriodoId: cierreId, monedaCode },
        negocioId,
      ),
    });

    return NextResponse.json(breakdown ?? null, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al obtener el desglose" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const { tiendaId, cierreId, monedaCode } = await params;

    // F-021, gate B: the period is resolved folded to the tenant before the upsert writes.
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: null,
    });
    if (!negocioId) return response;

    const cierre = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope(
        "cierrePeriodo",
        { id: cierreId, tiendaId },
        negocioId,
      ),
      select: { id: true },
    });
    if (!cierre) return tenantNotFoundResponse();

    const body = putBodySchema.parse(await req.json());

    const breakdown = await prisma.cashBreakdownMoneda.upsert({
      where: { cierrePeriodoId_monedaCode: { cierrePeriodoId: cierreId, monedaCode } },
      create: { cierrePeriodoId: cierreId, monedaCode, items: body.items, total: body.total },
      update: { items: body.items, total: body.total },
    });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al guardar el desglose" }, { status: 500 });
  }
}
