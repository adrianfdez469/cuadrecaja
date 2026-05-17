import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";

// Returns net cash on hand per currency for the given period:
// sum(cash received per currency) - sum(change given per currency)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> }
) {
  try {
    const { cierreId } = await params;
    await getSession();

    const ventas = await prisma.venta.findMany({
      where: { cierrePeriodoId: cierreId },
      select: { pagosDetalle: true, vueltoDetalle: true },
    });

    const balance: Record<string, number> = {};

    for (const venta of ventas) {
      if (venta.pagosDetalle) {
        const pagos = venta.pagosDetalle as unknown as IPagoLinea[];
        for (const pago of pagos) {
          if (pago.tipo === 'cash') {
            balance[pago.moneda] = (balance[pago.moneda] ?? 0) + pago.monto;
          }
        }
      }
      if (venta.vueltoDetalle) {
        const vueltos = venta.vueltoDetalle as unknown as IVueltoLinea[];
        for (const vuelto of vueltos) {
          balance[vuelto.moneda] = (balance[vuelto.moneda] ?? 0) - vuelto.monto;
        }
      }
    }

    return NextResponse.json(balance, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Error al obtener el balance de caja" }, { status: 500 });
  }
}
