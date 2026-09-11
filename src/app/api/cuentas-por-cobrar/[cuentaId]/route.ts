import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  assertPermisoEnTienda,
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";
import {
  CUENTAS_POR_COBRAR_API_ERRORS,
  CUENTAS_POR_COBRAR_PERMISO,
} from "@/constants/cuentasPorCobrar";
import type {
  ICuentaPorCobrarDetalleResponse,
  IMovimientoCuentaPorCobrarConAutor,
} from "@/schemas/cuentasPorCobrarPanel";
import {
  bucketAntiguedad,
  daysOutstanding,
} from "@/lib/cuentasPorCobrar/aging";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/**
 * GET /api/cuentas-por-cobrar/[cuentaId] — one account with its whole ledger.
 *
 * A `cuentaId` of ANOTHER business answers exactly like one that does not exist: 404, never 403
 * (criterion 13, ADR 0077). A 403 would confirm the row exists.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cuentaId: string }> },
) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({ session });
    if (response) return response;

    const { cuentaId } = await params;

    const cuenta = await prisma.cuentaPorCobrar.findFirst({
      where: withTenantScope("cuentaPorCobrar", { id: cuentaId }, negocioId),
      select: {
        id: true,
        ventaId: true,
        clienteId: true,
        tiendaId: true,
        fechaVenta: true,
        montoOriginal: true,
        saldoPendiente: true,
        settledAt: true,
        monedaDeudaCode: true,
        montoDeudaMonedaOriginal: true,
        tienda: { select: { nombre: true } },
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
            // The attribution lives ONLY in this read projection: neither the table nor the
            // write schema gains a column (contract § 5.6).
            usuario: { select: { nombre: true } },
          },
        },
      },
    });

    if (!cuenta) return tenantNotFoundResponse();

    // ADR 0107: the permission is checked against the store THE DEBT belongs to, never against
    // the one the session happens to have selected. `withTenantScope` above only bounds the row
    // to the business, so without this a user holding the permission in one store could operate
    // on a debt of another store of the same business. Ownership first, permission second.
    const denial = await assertPermisoEnTienda({
      session,
      tiendaId: cuenta.tiendaId,
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO,
    });
    if (denial) return denial;

    const at = new Date();

    const periodoAbierto = await prisma.cierrePeriodo.findFirst({
      where: withTenantScope(
        "cierrePeriodo",
        { fechaFin: null, tiendaId: cuenta.tiendaId },
        negocioId,
      ),
      select: { id: true },
    });

    const dias = daysOutstanding(cuenta.fechaVenta, at);

    const movimientos: IMovimientoCuentaPorCobrarConAutor[] =
      cuenta.movimientos.map((movimiento) => ({
        id: movimiento.id,
        cuentaPorCobrarId: movimiento.cuentaPorCobrarId,
        tipo: movimiento.tipo,
        monto: movimiento.monto,
        fecha: movimiento.fecha,
        pagosDetalle: (movimiento.pagosDetalle as IPagoLinea[] | null) ?? null,
        tasaSnapshot:
          (movimiento.tasaSnapshot as ITasaSnapshot | null) ?? null,
        motivo: movimiento.motivo ?? null,
        usuarioId: movimiento.usuarioId ?? null,
        revierteId: movimiento.revierteId ?? null,
        createdAt: movimiento.createdAt,
        usuarioNombre: movimiento.usuario?.nombre ?? null,
      }));

    const body: ICuentaPorCobrarDetalleResponse = {
      at,
      cuenta: {
        id: cuenta.id,
        ventaId: cuenta.ventaId,
        tiendaId: cuenta.tiendaId,
        tiendaNombre: cuenta.tienda?.nombre ?? "",
        fechaVenta: cuenta.fechaVenta,
        montoOriginal: cuenta.montoOriginal,
        saldoPendiente: cuenta.saldoPendiente,
        settledAt: cuenta.settledAt ?? null,
        monedaDeudaCode: cuenta.monedaDeudaCode ?? null,
        montoDeudaMonedaOriginal: cuenta.montoDeudaMonedaOriginal ?? null,
        dias,
        bucket: bucketAntiguedad(dias),
        cierrePeriodoAbiertoId: periodoAbierto?.id ?? null,
        clienteId: cuenta.clienteId,
        clienteNombre: cuenta.cliente?.nombre ?? "",
        movimientos,
      },
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("[GET /api/cuentas-por-cobrar/[cuentaId]]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
