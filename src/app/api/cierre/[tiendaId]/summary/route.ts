import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISummaryCierre } from "@/schemas/cierre";
import { startOfNextDay } from "@/utils/date";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";
import { calcularGananciaFinal } from "@/lib/gastos";

type Params = { tiendaId: string };
type MontosMap = Record<string, { bruto: number; descuentos: number }>;
type CierreResumenExt = {
  id: string;
  totalGanancia?: number | null;
  totalGananciasPropias?: number | null;
  totalGananciasConsignacion?: number | null;
  totalVentasPropias?: number | null;
  totalVentasConsignacion?: number | null;
  totalGastos?: number | null;
  totalGananciaFinal?: number | null;
  totalComprasCaja?: number | null;
  totalMerma?: number | null;
  totalDevoluciones?: number | null;
  totalVentasBrutas?: number;
  totalDescuentos?: number;
} & Record<string, unknown>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse<ISummaryCierre | { error: string }>> {
  try {
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");

    const nextDayToEndDate = startOfNextDay(new Date(fechaFin));

    const tienda = await prisma.tienda.findUnique({
      where: { id: tiendaId },
      select: { negocio: { select: { monedaBase: true } } },
    });
    const monedaBase = tienda?.negocio?.monedaBase ?? "CUP";

    const filtrosPeriodo = {
      ...(fechaInicio && {
        fechaInicio: { gte: new Date(fechaInicio).toISOString() },
      }),
      ...(fechaFin
        ? { fechaFin: { lte: nextDayToEndDate.toISOString() } }
        : { fechaFin: { not: null } }),
    };

    const filtros = {
      tiendaId: tiendaId,
      ...filtrosPeriodo,
    };

    const flitrosVentas = {
      tiendaId: tiendaId,
      totaltransfer: { gt: 0 },
      cierrePeriodo: filtrosPeriodo,
    };

    const cierres = await prisma.cierrePeriodo.findMany({
      where: { ...filtros },
      orderBy: { fechaInicio: "desc" },
      take: take,
      skip: skip,
    });

    const totalCierres = await prisma.cierrePeriodo.count({
      where: { ...filtros },
    });

    const transferenciasDesglosadas = await prisma.venta.groupBy({
      by: ["transferDestinationId"],
      _sum: { totaltransfer: true },
      where: { ...flitrosVentas },
    });

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

    const totales = await prisma.cierrePeriodo.aggregate({
      _sum: {
        totalGanancia: true,
        totalInversion: true,
        totalVentas: true,
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
      },
      where: { ...filtros },
    });

    // Calcular, para cada cierre en la página, los montos brutos y descuentos en moneda base
    const cierresIds = cierres.map((c) => c.id);
    let cierresConMontos: CierreResumenExt[] = [
      ...(cierres as CierreResumenExt[]),
    ];
    if (cierresIds.length > 0) {
      const ventasPorCierre = await prisma.venta.findMany({
        where: { cierrePeriodoId: { in: cierresIds }, tiendaId },
        select: {
          id: true,
          discountTotal: true,
          cierrePeriodoId: true,
          tasaSnapshot: true,
          productos: {
            select: { cantidad: true, precio: true, monedaPrecioCode: true },
          },
        },
      });
      const mapMontos: MontosMap = {};
      for (const v of ventasPorCierre) {
        const tasas = (v.tasaSnapshot ?? {}) as ITasaSnapshot;
        const bruto = (v.productos || []).reduce(
          (acc, p) =>
            acc +
            convertToBase(
              Number(p.precio) || 0,
              p.monedaPrecioCode ?? monedaBase,
              tasas,
              monedaBase,
            ) *
              (Number(p.cantidad) || 0),
          0,
        );
        const desc = Number(v.discountTotal ?? 0);
        if (!mapMontos[v.cierrePeriodoId])
          mapMontos[v.cierrePeriodoId] = { bruto: 0, descuentos: 0 };
        mapMontos[v.cierrePeriodoId].bruto += bruto;
        mapMontos[v.cierrePeriodoId].descuentos += desc;
      }

      cierresConMontos = cierres.map((c) => {
        const totalVentasBrutas = mapMontos[c.id]?.bruto || 0;
        const totalDescuentos = mapMontos[c.id]?.descuentos || 0;
        const totalVentasNetas = Math.max(
          0,
          totalVentasBrutas - totalDescuentos,
        );

        const ventasPropias = Number(
          (c as CierreResumenExt).totalVentasPropias || 0,
        );
        const ventasConsignacion = Number(
          (c as CierreResumenExt).totalVentasConsignacion || 0,
        );
        const gananciasPropias = Number(
          (c as CierreResumenExt).totalGananciasPropias || 0,
        );
        const gananciasConsignacion = Number(
          (c as CierreResumenExt).totalGananciasConsignacion || 0,
        );

        let descuentoPropias = 0;
        let descuentoConsignacion = 0;
        if (totalVentasBrutas > 0 && totalDescuentos > 0) {
          const ratioPropias = Math.max(
            0,
            Math.min(1, ventasPropias / totalVentasBrutas),
          );
          const ratioConsig = Math.max(
            0,
            Math.min(1, ventasConsignacion / totalVentasBrutas),
          );
          descuentoPropias = totalDescuentos * ratioPropias;
          descuentoConsignacion = totalDescuentos * ratioConsig;
        }

        const totalGananciasPropiasNet = Math.max(
          0,
          (gananciasPropias || 0) - (descuentoPropias || 0),
        );
        const totalGananciasConsignacionNet = Math.max(
          0,
          (gananciasConsignacion || 0) - (descuentoConsignacion || 0),
        );
        const totalGananciaNeta = Math.max(
          0,
          totalGananciasPropiasNet + totalGananciasConsignacionNet,
        );

        const totalGastos = Number((c as CierreResumenExt).totalGastos || 0);
        const totalMerma = Number((c as CierreResumenExt).totalMerma || 0);
        const totalDevoluciones = Number(
          (c as CierreResumenExt).totalDevoluciones || 0,
        );
        const totalGananciaFinal = calcularGananciaFinal(
          totalGananciaNeta,
          totalGastos,
          totalMerma,
          totalDevoluciones,
        );

        return {
          ...c,
          totalVentas: totalVentasNetas,
          totalVentasBrutas,
          totalDescuentos,
          totalGanancia: totalGananciaNeta,
          totalGananciasPropias: totalGananciasPropiasNet,
          totalGananciasConsignacion: totalGananciasConsignacionNet,
          totalGastos,
          totalGananciaFinal,
        } as CierreResumenExt;
      });
    }

    // Agregados globales — bruto y descuentos en moneda base
    // Mismo alcance que `filtros`: ventas de los cierres del rango (todas las páginas)
    const ventasParaTotales = await prisma.venta.findMany({
      where: {
        tiendaId,
        cierrePeriodo: filtrosPeriodo,
      },
      select: {
        discountTotal: true,
        tasaSnapshot: true,
        productos: {
          select: { cantidad: true, precio: true, monedaPrecioCode: true },
        },
      },
    });
    const sumTotalDescuentos = ventasParaTotales.reduce(
      (acc, v) => acc + Number(v.discountTotal ?? 0),
      0,
    );
    const sumTotalVentasBrutas = ventasParaTotales.reduce((acc, v) => {
      const tasas = (v.tasaSnapshot ?? {}) as ITasaSnapshot;
      return (
        acc +
        (v.productos || []).reduce(
          (a, p) =>
            a +
            convertToBase(
              Number(p.precio) || 0,
              p.monedaPrecioCode ?? monedaBase,
              tasas,
              monedaBase,
            ) *
              (Number(p.cantidad) || 0),
          0,
        )
      );
    }, 0);
    const sumTotalVentas = Math.max(
      0,
      sumTotalVentasBrutas - sumTotalDescuentos,
    );

    // Ganancias netas de descuento a nivel GLOBAL (todas las páginas del rango),
    // prorrateando los descuentos por bucket Propias/Consignación — mismo
    // criterio que el cálculo por cierre de arriba.
    const gananciasPropiasGlobal = totales._sum.totalGananciasPropias ?? 0;
    const gananciasConsigGlobal = totales._sum.totalGananciasConsignacion ?? 0;
    const ventasPropiasGlobal = totales._sum.totalVentasPropias ?? 0;
    const ventasConsigGlobal = totales._sum.totalVentasConsignacion ?? 0;

    let descuentoPropiasGlobal = 0;
    let descuentoConsigGlobal = 0;
    if (sumTotalVentasBrutas > 0 && sumTotalDescuentos > 0) {
      const ratioPropias = Math.max(
        0,
        Math.min(1, ventasPropiasGlobal / sumTotalVentasBrutas),
      );
      const ratioConsig = Math.max(
        0,
        Math.min(1, ventasConsigGlobal / sumTotalVentasBrutas),
      );
      descuentoPropiasGlobal = sumTotalDescuentos * ratioPropias;
      descuentoConsigGlobal = sumTotalDescuentos * ratioConsig;
    }

    const sumTotalGananciasPropiasNet = Math.max(
      0,
      gananciasPropiasGlobal - descuentoPropiasGlobal,
    );
    const sumTotalGananciasConsigNet = Math.max(
      0,
      gananciasConsigGlobal - descuentoConsigGlobal,
    );
    const sumTotalGananciaNet =
      sumTotalGananciasPropiasNet + sumTotalGananciasConsigNet;

    // Global aggregates from DB — these cover ALL pages, not just the current one
    const sumTotalGastos = totales._sum.totalGastos ?? 0;
    const sumTotalMerma = totales._sum.totalMerma ?? 0;
    const sumTotalDevoluciones = totales._sum.totalDevoluciones ?? 0;
    const sumTotalComprasCaja = totales._sum.totalComprasCaja ?? 0;
    // Ganancia final neta de descuentos, gastos, merma y devoluciones (el valor
    // almacenado en CierrePeriodo.totalGananciaFinal no netea descuentos)
    const sumTotalGananciaFinal = calcularGananciaFinal(
      sumTotalGananciaNet,
      sumTotalGastos,
      sumTotalMerma,
      sumTotalDevoluciones,
    );

    return NextResponse.json({
      cierres: cierresConMontos as unknown as ISummaryCierre["cierres"],
      sumTotalGanancia: sumTotalGananciaNet,
      sumTotalInversion: totales._sum.totalInversion,
      sumTotalVentas,
      sumTotalTransferencia: totales._sum.totalTransferencia,
      desgloseTransferencias: transferenciasConNombres,
      sumTotalVentasPropias: totales._sum.totalVentasPropias,
      sumTotalVentasConsignacion: totales._sum.totalVentasConsignacion,
      sumTotalGananciasPropias: sumTotalGananciasPropiasNet,
      sumTotalGananciasConsignacion: sumTotalGananciasConsigNet,
      sumTotalVentasBrutas,
      sumTotalDescuentos,
      sumTotalGastos,
      sumTotalMerma,
      sumTotalDevoluciones,
      sumTotalComprasCaja,
      sumTotalGananciaFinal,
      totalItems: totalCierres,
    });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al obtener los datos del cierre" },
      { status: 500 },
    );
  }
}
