import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  assertPermisoEnTienda,
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string; proveedorId: string }> },
) {
  try {
    const { cierreId, proveedorId } = await params;

    // F-021, gate B: same permission the verb already demanded, plus the tenant clause folded
    // into the updateMany so a foreign settlement simply matches no row (ADR 0078).
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({ session });
    if (!negocioId) return response;

    if (!cierreId) {
      return NextResponse.json(
        { error: "Cierre ID es requerido" },
        { status: 400 },
      );
    }

    // Gate B, step two (ADR 0107). The store is only knowable once the period is
    // read, so the period is read FIRST — which this route did not do at all:
    // it fired the updateMany blind, and a cierreId of another business updated
    // nothing while still answering 200 "Productos editados correctamente".
    // Now it answers 404, which is what it always meant.
    const cierre = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope("cierrePeriodo", { id: cierreId }, negocioId),
      select: { tiendaId: true },
    });
    if (!cierre) return tenantNotFoundResponse();

    const denial = await assertPermisoEnTienda({
      session,
      tiendaId: cierre.tiendaId,
      permisoRequerido: "configuracion.proveedores.liquidar",
    });
    if (denial) return denial;

    await prisma.productoProveedorLiquidacion.updateMany({
      where: withTenantScope(
        "productoProveedorLiquidacion",
        {
          cierreId,
          proveedorId,
        },
        negocioId,
      ),
      data: {
        liquidatedAt: new Date(),
      },
    });

    return NextResponse.json(
      { message: "Productos editados correctamente" },
      { status: 200 },
    );
  } catch (error) {
    console.error("❌ Error al realizar la liquidación:", error);
    return NextResponse.json(
      { error: "Error al realizar la liquidación" },
      { status: 500 },
    );
  }
}
