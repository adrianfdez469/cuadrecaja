import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import {
  resolveTenantAxis,
  withTenantScope,
} from "@/lib/tenantScope";
import {
  CUENTAS_POR_COBRAR_API_ERRORS,
  CUENTAS_POR_COBRAR_PERMISO,
} from "@/constants/cuentasPorCobrar";
import {
  cuentasPorCobrarFiltrosSchema,
  type ICuentasPorCobrarListResponse,
} from "@/schemas/cuentasPorCobrarPanel";
import type { IAgingBucket } from "@/lib/cuentasPorCobrar/aging";
import {
  buildDeudorRows,
  filterByBucket,
  withAging,
  type ICuentaPanelInput,
  type IDeudorInput,
} from "@/lib/cuentasPorCobrar/panel";

/**
 * GET /api/cuentas-por-cobrar — the debtor listing of the panel.
 *
 * The tenant axis comes ONLY from the session (contract § 9). No `negocioId` is ever read from
 * the path, the query or the body.
 *
 * There is no pagination, by decision: ADR 0119. `total` is the length of `data`.
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    const { negocioId, response } = resolveTenantAxis({
      session,
      permisoRequerido: CUENTAS_POR_COBRAR_PERMISO,
    });
    if (response) return response;

    const { searchParams } = new URL(req.url);
    const parsed = cuentasPorCobrarFiltrosSchema.safeParse({
      tiendaId: searchParams.get("tiendaId") ?? undefined,
      clienteId: searchParams.get("clienteId") ?? undefined,
      antiguedad: searchParams.get("antiguedad") ?? undefined,
      estado: searchParams.get("estado") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: CUENTAS_POR_COBRAR_API_ERRORS.cuerpoInvalido,
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const filtros = parsed.data;

    // ONE clock for the whole answer, echoed in the response: two rows of the same answer can
    // never land in different brackets (dosier § 7).
    const at = new Date();

    const cuentas = await prisma.cuentaPorCobrar.findMany({
      where: withTenantScope(
        "cuentaPorCobrar",
        {
          ...(filtros.tiendaId ? { tiendaId: filtros.tiendaId } : {}),
          ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
          ...(filtros.estado === "CON_DEUDA" ? { settledAt: null } : {}),
          ...(filtros.estado === "SALDADA"
            ? { settledAt: { not: null } }
            : {}),
        },
        negocioId,
      ),
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
        cliente: { select: { id: true, nombre: true, telefono: true } },
      },
      orderBy: { fechaVenta: "desc" },
    });

    const clienteIds = [...new Set(cuentas.map((c) => c.clienteId))];

    // `ultimoAbonoAt` looks at EVERY account of the debtor, live and settled, and does not
    // intersect with the aging filter (contract § 13). Hence this second, minimal read: the
    // query above may have been narrowed by the filters.
    const [todasLasCuentas, periodosAbiertos] = await Promise.all([
      clienteIds.length > 0
        ? prisma.cuentaPorCobrar.findMany({
            where: withTenantScope(
              "cuentaPorCobrar",
              { clienteId: { in: clienteIds } },
              negocioId,
            ),
            select: { id: true, clienteId: true },
          })
        : Promise.resolve([] as { id: string; clienteId: string }[]),
      // ONE query for the whole response, never one per account (N+1).
      prisma.cierrePeriodo.findMany({
        where: withTenantScope(
          "cierrePeriodo",
          {
            fechaFin: null,
            tiendaId: { in: [...new Set(cuentas.map((c) => c.tiendaId))] },
          },
          negocioId,
        ),
        select: { id: true, tiendaId: true },
      }),
    ]);

    const clientePorCuenta = new Map<string, string>();
    for (const cuenta of todasLasCuentas) {
      clientePorCuenta.set(cuenta.id, cuenta.clienteId);
    }

    const ultimosAbonos =
      todasLasCuentas.length > 0
        ? await prisma.movimientoCuentaPorCobrar.groupBy({
            by: ["cuentaPorCobrarId"],
            where: withTenantScope(
              "movimientoCuentaPorCobrar",
              {
                tipo: "ABONO",
                cuentaPorCobrarId: { in: [...clientePorCuenta.keys()] },
              },
              negocioId,
            ),
            _max: { fecha: true },
          })
        : [];

    const ultimoAbonoPorCliente = new Map<string, Date>();
    for (const fila of ultimosAbonos) {
      const clienteId = clientePorCuenta.get(fila.cuentaPorCobrarId);
      const fecha = fila._max.fecha;
      if (!clienteId || !fecha) continue;
      const previo = ultimoAbonoPorCliente.get(clienteId);
      if (!previo || fecha > previo) ultimoAbonoPorCliente.set(clienteId, fecha);
    }

    const cierrePeriodoAbiertoPorTienda: Record<string, string> = {};
    for (const periodo of periodosAbiertos) {
      cierrePeriodoAbiertoPorTienda[periodo.tiendaId] = periodo.id;
    }

    const bucket = (filtros.antiguedad as IAgingBucket) ?? null;
    const porCliente = new Map<string, IDeudorInput>();

    for (const cuenta of cuentas) {
      let deudor = porCliente.get(cuenta.clienteId);
      if (!deudor) {
        deudor = {
          clienteId: cuenta.clienteId,
          clienteNombre: cuenta.cliente?.nombre ?? "",
          telefono: cuenta.cliente?.telefono ?? null,
          cuentas: [],
          ultimoAbonoAt: ultimoAbonoPorCliente.get(cuenta.clienteId) ?? null,
          cierrePeriodoAbiertoPorTienda,
        };
        porCliente.set(cuenta.clienteId, deudor);
      }

      // Only the LIVE accounts feed the row: a settled one has nothing left to collect and its
      // aging would be a number without meaning.
      if (cuenta.settledAt !== null) continue;

      const panelInput: ICuentaPanelInput = {
        id: cuenta.id,
        ventaId: cuenta.ventaId,
        clienteId: cuenta.clienteId,
        tiendaId: cuenta.tiendaId,
        tiendaNombre: cuenta.tienda?.nombre ?? "",
        fechaVenta: cuenta.fechaVenta,
        montoOriginal: cuenta.montoOriginal,
        saldoPendiente: cuenta.saldoPendiente,
        settledAt: cuenta.settledAt,
        monedaDeudaCode: cuenta.monedaDeudaCode ?? null,
        montoDeudaMonedaOriginal: cuenta.montoDeudaMonedaOriginal ?? null,
      };

      deudor.cuentas.push(...filterByBucket(withAging([panelInput], at), bucket));
    }

    // A debtor whose accounts all fall outside the aging filter does NOT appear (§ 5.1). With no
    // aging filter, a fully settled debtor stays: its `estado` is what criterion 1 verifies.
    const deudores = [...porCliente.values()].filter(
      (deudor) => !bucket || deudor.cuentas.length > 0,
    );

    const data = buildDeudorRows(deudores);

    const body: ICuentasPorCobrarListResponse = {
      at,
      total: data.length,
      data,
    };

    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    // A FIXED message, never the exception's own: the runtime cites the value that broke it
    // (E-031).
    console.error("[GET /api/cuentas-por-cobrar]", error);
    return NextResponse.json(
      { error: CUENTAS_POR_COBRAR_API_ERRORS.errorInterno },
      { status: 500 },
    );
  }
}
