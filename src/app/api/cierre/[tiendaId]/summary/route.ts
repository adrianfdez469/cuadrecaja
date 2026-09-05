import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISummaryCierre } from "@/schemas/cierre";
import { startOfNextDay } from "@/utils/date";
import { getSession } from "@/utils/auth";
import { loadTasaHistory } from "@/lib/tasaSnapshotResolver";
import { calcularGananciaFinal } from "@/lib/gastos";
import {
  hasTotalsDrift,
  sumSalesTotals,
  valueSales,
  type CierreSale,
} from "@/lib/cierre/computeCierreTotals";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

type Params = { tiendaId: string };

/** The drift check values the sales of every period on the page. */
const MAX_SUMMARY_PAGE_SIZE = 100;

type LegacyCierreRow = {
  totalVentasPropias: number;
  totalVentasConsignacion: number;
  totalGananciasPropias: number;
  totalGananciasConsignacion: number;
  totalGastos: number;
  totalMerma: number;
  totalDevoluciones: number;
};

/**
 * The previous close stored profit gross of discounts; the new engine stores
 * it net. Until a legacy period is recalculated, its profit is netted here
 * with the same proration the engine applies.
 */
function netLegacyGanancia(
  c: LegacyCierreRow,
  live: { totalVentasBrutas: number; totalDescuentos: number },
) {
  let descuentoPropias = 0;
  let descuentoConsignacion = 0;
  if (live.totalVentasBrutas > 0 && live.totalDescuentos > 0) {
    descuentoPropias =
      live.totalDescuentos *
      Math.min(1, c.totalVentasPropias / live.totalVentasBrutas);
    descuentoConsignacion =
      live.totalDescuentos *
      Math.min(1, c.totalVentasConsignacion / live.totalVentasBrutas);
  }
  const totalGananciasPropias = Math.max(
    0,
    c.totalGananciasPropias - descuentoPropias,
  );
  const totalGananciasConsignacion = Math.max(
    0,
    c.totalGananciasConsignacion - descuentoConsignacion,
  );
  const totalGanancia = totalGananciasPropias + totalGananciasConsignacion;
  return {
    totalGananciasPropias,
    totalGananciasConsignacion,
    totalGanancia,
    totalGananciaFinal: calcularGananciaFinal(
      totalGanancia,
      c.totalGastos,
      c.totalMerma,
      c.totalDevoluciones,
    ),
  };
}

/**
 * GET /api/cierre/[tiendaId]/summary
 *
 * The closed periods of a store, as stored at the close (ADR 0036). The
 * sales of the page are still valued once, only to flag the periods whose
 * sales changed after the close (`totalesDesactualizados`) and to keep
 * valuing live the periods the previous engine closed, which have no stored
 * gross/discount figures until they are recalculated.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse<ISummaryCierre | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const take = Math.min(
      MAX_SUMMARY_PAGE_SIZE,
      Math.max(1, Number.parseInt(searchParams.get("take") || "20") || 20),
    );
    const skip = Math.max(
      0,
      Number.parseInt(searchParams.get("skip") || "0") || 0,
    );
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    const session = await getSession();
    const negocioId = session.user.negocio.id;

    const tienda = await prisma.tienda.findFirst({
      where: { id: tiendaId, negocioId },
      select: { negocio: { select: { id: true, monedaBase: true } } },
    });
    if (!tienda) {
      return NextResponse.json(
        { error: "Tienda no encontrada" },
        { status: 404 },
      );
    }
    const monedaBase = tienda.negocio.monedaBase ?? "CUP";

    const nextDayToEndDate = startOfNextDay(new Date(fechaFin));
    const filtrosPeriodo = {
      ...(fechaInicio && {
        fechaInicio: { gte: new Date(fechaInicio).toISOString() },
      }),
      ...(fechaFin
        ? { fechaFin: { lte: nextDayToEndDate.toISOString() } }
        : { fechaFin: { not: null } }),
    };
    const filtros = { tiendaId, ...filtrosPeriodo };

    const [cierres, totalCierres, totales, transferenciasDesglosadas] =
      await Promise.all([
        prisma.cierrePeriodo.findMany({
          where: filtros,
          orderBy: { fechaInicio: "desc" },
          take,
          skip,
        }),
        prisma.cierrePeriodo.count({ where: filtros }),
        prisma.cierrePeriodo.aggregate({
          _sum: {
            totalGanancia: true,
            totalInversion: true,
            totalVentas: true,
            totalVentasBrutas: true,
            totalDescuentos: true,
            totalTransferencia: true,
            totalVentasPropias: true,
            totalVentasConsignacion: true,
            totalGananciasPropias: true,
            totalGananciasConsignacion: true,
            totalGastos: true,
            totalGananciaFinal: true,
            totalComprasCaja: true,
            totalMerma: true,
            totalDevoluciones: true,
            totalTips: true,
          },
          where: filtros,
        }),
        prisma.venta.groupBy({
          by: ["transferDestinationId"],
          _sum: { totaltransfer: true },
          where: {
            tiendaId,
            totaltransfer: { gt: 0 },
            cierrePeriodo: filtrosPeriodo,
          },
        }),
      ]);

    const destinationIds = transferenciasDesglosadas
      .map((item) => item.transferDestinationId)
      .filter((id) => id !== null);
    const destinationsNames = await prisma.transferDestinations.findMany({
      where: { id: { in: destinationIds } },
      select: { id: true, nombre: true },
    });
    const transferenciasConNombres = transferenciasDesglosadas.map((item) => ({
      ...item,
      destinationName:
        destinationsNames.find((dest) => dest.id === item.transferDestinationId)
          ?.nombre || "Sin nombre",
    }));

    // Drift check: value the sales of the page's periods with the same
    // engine that stored their totals.
    const cierresIds = cierres.map((c) => c.id);
    const [ventasPorCierre, historialTasas] = await Promise.all([
      cierresIds.length > 0
        ? prisma.venta.findMany({
            where: { cierrePeriodoId: { in: cierresIds }, tiendaId },
            select: {
              id: true,
              createdAt: true,
              discountTotal: true,
              tipTotal: true,
              totaltransfer: true,
              cierrePeriodoId: true,
              tasaSnapshot: true,
              productos: {
                select: {
                  cantidad: true,
                  precio: true,
                  costo: true,
                  monedaPrecioCode: true,
                  monedaCostoCode: true,
                  productoTiendaId: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      loadTasaHistory(tienda.negocio.id),
    ]);

    const ventasByCierre = new Map<string, CierreSale[]>();
    for (const v of ventasPorCierre) {
      const sale: CierreSale = {
        id: v.id,
        createdAt: v.createdAt,
        discountTotal: Number(v.discountTotal ?? 0),
        tipTotal: Number(v.tipTotal ?? 0),
        totaltransfer: v.totaltransfer,
        tasaSnapshot: (v.tasaSnapshot as ITasaSnapshot | null) ?? null,
        pagosDetalle: null as IPagoLinea[] | null,
        vueltoDetalle: null as IVueltoLinea[] | null,
        tipDetail: null,
        usuario: null,
        transferDestination: null,
        appliedDiscounts: [],
        productos: v.productos.map((p) => ({
          productoTiendaId: p.productoTiendaId,
          productoId: "",
          nombre: "",
          cantidad: p.cantidad,
          costo: p.costo,
          precio: p.precio,
          monedaCostoCode: p.monedaCostoCode,
          monedaPrecioCode: p.monedaPrecioCode,
          proveedor: null,
          existencia: 0,
        })),
      };
      (ventasByCierre.get(v.cierrePeriodoId) ??
        ventasByCierre.set(v.cierrePeriodoId, []).get(v.cierrePeriodoId))!.push(
        sale,
      );
    }

    const cierresConEstado = cierres.map((c) => {
      const live = sumSalesTotals(
        valueSales(ventasByCierre.get(c.id) ?? [], monedaBase, historialTasas),
      );
      const legacy = !c.totalsComputedAt;
      return {
        ...c,
        // A period the previous engine closed has no stored gross/discounts
        // and its stored profit is gross of discounts: its figures stay live
        // until the recalculation stores them.
        ...(legacy && {
          totalVentas: live.totalVentas,
          totalVentasBrutas: live.totalVentasBrutas,
          totalDescuentos: live.totalDescuentos,
          ...netLegacyGanancia(c, live),
        }),
        totalesDesactualizados:
          legacy || hasTotalsDrift(c.totalVentas, live.totalVentas),
      };
    });

    return NextResponse.json({
      cierres: cierresConEstado as unknown as ISummaryCierre["cierres"],
      sumTotalGanancia: totales._sum.totalGanancia ?? 0,
      sumTotalInversion: totales._sum.totalInversion ?? 0,
      sumTotalVentas: totales._sum.totalVentas ?? 0,
      sumTotalTransferencia: totales._sum.totalTransferencia ?? 0,
      desgloseTransferencias: transferenciasConNombres,
      sumTotalVentasPropias: totales._sum.totalVentasPropias ?? 0,
      sumTotalVentasConsignacion: totales._sum.totalVentasConsignacion ?? 0,
      sumTotalGananciasPropias: totales._sum.totalGananciasPropias ?? 0,
      sumTotalGananciasConsignacion:
        totales._sum.totalGananciasConsignacion ?? 0,
      sumTotalVentasBrutas: totales._sum.totalVentasBrutas ?? 0,
      sumTotalDescuentos: totales._sum.totalDescuentos ?? 0,
      sumTotalGastos: totales._sum.totalGastos ?? 0,
      sumTotalMerma: totales._sum.totalMerma ?? 0,
      sumTotalDevoluciones: totales._sum.totalDevoluciones ?? 0,
      sumTotalComprasCaja: totales._sum.totalComprasCaja ?? 0,
      sumTotalGananciaFinal: totales._sum.totalGananciaFinal ?? 0,
      sumTotalTips: totales._sum.totalTips ?? 0,
      totalItems: totalCierres,
    });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al obtener los datos del cierre" },
      { status: 500 },
    );
  }
}
