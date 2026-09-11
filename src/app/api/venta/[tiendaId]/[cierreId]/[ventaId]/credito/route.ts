import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant, withTenantScope } from "@/lib/tenantScope";
import { summarizeVentaCobros } from "@/lib/cuentasPorCobrar/ventaCreditoEstado";
import type { IVentaCreditoDetalleResponse } from "@/schemas/ventaCredito";
import type { IMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";

/**
 * GET - The debt of ONE sale, with its whole ledger.
 *
 * NO PERMISSION, exactly like the listing GET it is the sibling of
 * (`api/venta/[tiendaId]/[cierreId]/route.ts`): it returns, for a single sale, a subset of what
 * that one already returns without a permission for every sale of the period, and it is the
 * cashier flow of `/ventas`. The panel of F-035 is the one that requires
 * `recuperaciones.cuentasporcobrar.acceder`, and this route is not it.
 *
 * The CuentaPorCobrar is reached ONLY through the Venta already resolved under the tenant axis —
 * the relation is @unique per sale — and no `cuentaId` from the request is ever accepted.
 *
 * It does NOT paginate: it is bounded to one sale, whose ledger is its own collections. If some
 * day a pathological case disproved that, the bound is added here and not in the caller.
 */
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ tiendaId: string; cierreId: string; ventaId: string }>;
  },
) {
  try {
    const { tiendaId, cierreId, ventaId } = await params;

    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: null,
    });
    if (!scope) return response;

    const venta = await prisma.venta.findFirst({
      where: withTenantScope(
        "venta",
        { id: ventaId, cierrePeriodoId: cierreId, tiendaId },
        scope.negocioId,
      ),
      select: {
        id: true,
        cuentaPorCobrar: {
          select: {
            id: true,
            clienteId: true,
            montoOriginal: true,
            saldoPendiente: true,
            settledAt: true,
            monedaDeudaCode: true,
            montoDeudaMonedaOriginal: true,
            cliente: { select: { nombre: true } },
            movimientos: {
              orderBy: { fecha: "desc" },
              select: {
                id: true,
                cuentaPorCobrarId: true,
                tipo: true,
                monto: true,
                fecha: true,
                pagosDetalle: true,
                tasaSnapshot: true,
                motivo: true,
                usuarioId: true,
                revierteId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    // The SAME 404 for "the sale is not in this tenant/tienda/cierre" and for "it exists but has
    // no CuentaPorCobrar", so the route is not an oracle for ids of another business (ADR 0077).
    const cuenta = venta?.cuentaPorCobrar ?? null;
    if (!venta || !cuenta) {
      return NextResponse.json(
        { error: "Credito de la venta no encontrado" },
        { status: 404 },
      );
    }

    // One read: the counts are derived from the very rows the detail already carries.
    const resumen = summarizeVentaCobros(cuenta.movimientos);

    const body: IVentaCreditoDetalleResponse = {
      at: new Date(),
      cuenta: {
        cuentaId: cuenta.id,
        ventaId: venta.id,
        clienteId: cuenta.clienteId,
        clienteNombre: cuenta.cliente?.nombre ?? "",
        montoOriginal: Number(cuenta.montoOriginal ?? 0),
        saldoPendiente: Number(cuenta.saldoPendiente ?? 0),
        settledAt: cuenta.settledAt ?? null,
        monedaDeudaCode: cuenta.monedaDeudaCode ?? null,
        // `!= null` covers the null, the undefined and the absent key at once (§ 0.6 (d)).
        montoDeudaMonedaOriginal:
          cuenta.montoDeudaMonedaOriginal != null
            ? Number(cuenta.montoDeudaMonedaOriginal)
            : null,
        cobros: resumen.cobros,
        cobrosMontoBase: resumen.cobrosMontoBase,
        movimientos: resumen.movimientos,
        // `pagosDetalle` and `tasaSnapshot` are Json columns, so Prisma types them as
        // `JsonValue`; the rows travel VERBATIM as persisted and the shape is the one
        // `movimientoCuentaPorCobrarSchema` declares (IMPORTED from F-031, never restated).
        movimientosDetalle:
          cuenta.movimientos as unknown as IMovimientoCuentaPorCobrar[],
      },
    };

    return NextResponse.json(body);
  } catch (error) {
    console.error("[GET credito venta]", error);
    return NextResponse.json(
      { error: "Error al obtener el credito de la venta" },
      { status: 500 },
    );
  }
}
