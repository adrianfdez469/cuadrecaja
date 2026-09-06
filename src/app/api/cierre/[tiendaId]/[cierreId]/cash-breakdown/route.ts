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
  currency: z.string().default("CUP"),
  items: z.array(billCountSchema),
  total: z.number().min(0),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> }
) {
  try {
    const { cierreId } = await params;

    // F-021, gate B. The `getSession()` that used to be called and thrown away is now used.
    // No permission — counting the drawer is part of the cashier flow (ADR 0078).
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: null,
    });
    if (!negocioId) return response;

    const breakdown = await prisma.cashBreakdownCierre.findFirst({
      where: withTenantScope(
        "cashBreakdownCierre",
        { cierrePeriodoId: cierreId },
        negocioId,
      ),
    });

    if (!breakdown) return NextResponse.json(null, { status: 200 });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al obtener el desglose" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> }
) {
  try {
    const { tiendaId, cierreId } = await params;

    // F-021, gate B. The `tiendaId` of the path, unused until now, becomes part of the check.
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

    const breakdown = await prisma.cashBreakdownCierre.upsert({
      where: { cierrePeriodoId: cierreId },
      create: {
        cierrePeriodoId: cierreId,
        currency: body.currency,
        items: body.items,
        total: body.total,
      },
      update: {
        currency: body.currency,
        items: body.items,
        total: body.total,
      },
    });

    return NextResponse.json(breakdown, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al guardar el desglose" }, { status: 500 });
  }
}
