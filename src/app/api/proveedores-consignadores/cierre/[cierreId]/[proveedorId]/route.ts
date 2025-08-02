import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ cierreId: string, proveedorId: string }> }
) {
  try {
    const { cierreId, proveedorId } = await params;

    const session = await getSession();
    const user = session.user;
    if (!verificarPermisoUsuario(user.permisos, "configuracion.proveedores.liquidar", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    if (!cierreId) {
      return NextResponse.json(
        { error: "Cierre ID es requerido" },
        { status: 400 }
      );
    }

    await prisma.productoProveedorLiquidacion.updateMany({
      where: {
        cierreId,
        proveedorId
      },
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
