import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { resolveTenantAxis, withTenantScope } from "@/lib/tenantScope";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string, proveedorId: string }> }
) {
  try {
    const { cierreId, proveedorId } = await params;

    // F-021, gate B: same permission the verb already demanded, plus the tenant clause folded
    // into the updateMany so a foreign settlement simply matches no row (ADR 0078).
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: "configuracion.proveedores.liquidar",
    });
    if (!negocioId) return response;

    if (!cierreId) {
      return NextResponse.json(
        { error: "Cierre ID es requerido" },
        { status: 400 }
      );
    }

    await prisma.productoProveedorLiquidacion.updateMany({
      where: withTenantScope(
        "productoProveedorLiquidacion",
        {
          cierreId,
          proveedorId
        },
        negocioId,
      ),
      data: {
        liquidatedAt: new Date()
      }
    });

    
    return NextResponse.json(
      { message: "Productos editados correctamente" },
      { status: 200 }
    );

  } catch (error) {
    console.error("❌ Error al realizar la liquidación:", error);
    return NextResponse.json(
      { error: "Error al realizar la liquidación" },
      { status: 500 }
    );
  }
}
