import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  assertPermisoEnNegocio,
  resolveTenantAxis,
  tenantNotFoundResponse,
  withTenantScope,
} from "@/lib/tenantScope";
import {
  CUENTAS_POR_COBRAR_API_ERRORS,
  CUENTAS_POR_COBRAR_PERMISO,
} from "@/constants/cuentasPorCobrar";
import type {
  IDeudorDetalleResponse,
  IMovimientoCuentaPorCobrarConAutor,
} from "@/schemas/cuentasPorCobrarPanel";
import {
  bucketAntiguedad,
  daysOutstanding,
  MIN_OPEN_BALANCE_BASE,
} from "@/lib/cuentasPorCobrar/aging";
import { mapVentaToIVenta } from "@/lib/ventaMapper";
import type { IPagoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * GET /api/cuentas-por-cobrar/cliente/[clienteId] — everything the debtor detail screen needs,
 * in ONE call: every account (live and settled, newest first), its ledger with the author of
 * each entry, and the sale already mapped to `IVenta` so `VentaDetailDialog` opens with no
 * second request.
 *
 * `cliente` is a STATIC sibling of `[cuentaId]`: Next resolves the static segment first, and no
 * `cuentaId` is ever the string "cliente" because the schema demands a uuid.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ clienteId: string }> },
) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({ session });
    if (response) return response;

    // Business-scoped resource: no single store bounds it, so the gate uses the
    // permissions the session carries. See assertPermisoEnNegocio.
    const denial = assertPermisoEnNegocio({
      session,
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO,
    });
    if (denial) return denial;

    const { clienteId } = await params;

    const cliente = await prisma.cliente.findFirst({
      where: withTenantScope("cliente", { id: clienteId }, negocioId),
      select: { id: true, nombre: true, telefono: true },
    });
    if (!cliente) return tenantNotFoundResponse();

    const at = new Date();

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: withTenantScope("cuentaPorCobrar", { clienteId }, negocioId),
      orderBy: { fechaVenta: "desc" },
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
            usuario: { select: { nombre: true } },
          },
        },
        venta: {
          include: {
            usuario: { select: { id: true, nombre: true } },
            productos: {
              select: {
                cantidad: true,
                id: true,
                productoTiendaId: true,
                precio: true,
                costo: true,
                monedaPrecioCode: true,
                producto: {
                  select: {
                    proveedor: { select: { id: true, nombre: true } },
                    producto: { select: { nombre: true, id: true } },
                  },
                },
              },
            },
            appliedDiscounts: {
              include: { discountRule: { select: { name: true } } },
            },
            transferDestination: { select: { id: true, nombre: true } },
          },
        },
      },
    });

    // ONE query for the whole response, never one per account (N+1).
    const periodosAbiertos = await prisma.cierrePeriodo.findMany({
      where: withTenantScope(
        "cierrePeriodo",
        {
          fechaFin: null,
          tiendaId: { in: [...new Set(cuentas.map((c) => c.tiendaId))] },
        },
        negocioId,
      ),
      select: { id: true, tiendaId: true },
    });

    const cierrePeriodoAbiertoPorTienda: Record<string, string> = {};
    for (const periodo of periodosAbiertos) {
      cierrePeriodoAbiertoPorTienda[periodo.tiendaId] = periodo.id;
    }

    const saldo = round2(
      cuentas
        .filter((cuenta) => cuenta.saldoPendiente > MIN_OPEN_BALANCE_BASE)
        .reduce((sum, cuenta) => sum + cuenta.saldoPendiente, 0),
    );

    const body: IDeudorDetalleResponse = {
      at,
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        telefono: cliente.telefono ?? null,
      },
      saldo,
      cuentas: cuentas.map((cuenta) => {
        const dias = daysOutstanding(cuenta.fechaVenta, at);

        const movimientos: IMovimientoCuentaPorCobrarConAutor[] =
          cuenta.movimientos.map((movimiento) => ({
            id: movimiento.id,
            cuentaPorCobrarId: movimiento.cuentaPorCobrarId,
            tipo: movimiento.tipo,
            monto: movimiento.monto,
            fecha: movimiento.fecha,
            pagosDetalle:
              (movimiento.pagosDetalle as IPagoLinea[] | null) ?? null,
            tasaSnapshot:
              (movimiento.tasaSnapshot as ITasaSnapshot | null) ?? null,
            motivo: movimiento.motivo ?? null,
            usuarioId: movimiento.usuarioId ?? null,
            revierteId: movimiento.revierteId ?? null,
            createdAt: movimiento.createdAt,
            usuarioNombre: movimiento.usuario?.nombre ?? null,
          }));

        return {
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
          cierrePeriodoAbiertoId:
            cierrePeriodoAbiertoPorTienda[cuenta.tiendaId] ?? null,
          clienteId: cuenta.clienteId,
          clienteNombre: cliente.nombre,
          movimientos,
          // `mapVentaToIVenta` is IMPORTED, never copied (contract § 7).
          venta: cuenta.venta ? mapVentaToIVenta(cuenta.venta) : null,
        };
      }),
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    console.error("[GET /api/cuentas-por-cobrar/cliente/[clienteId]]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
