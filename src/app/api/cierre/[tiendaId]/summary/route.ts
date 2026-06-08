import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISummaryCierre } from "@/schemas/cierre";
import { startOfNextDay } from "@/utils/date";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { convertToBase } from "@/lib/currency";

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

    const filtros = {
      tiendaId: tiendaId,
      ...(fechaInicio && {
        fechaInicio: { gte: new Date(fechaInicio).toISOString() },
      }),
      ...(fechaFin
        ? { fechaFin: { lte: nextDayToEndDate.toISOString() } }
        : { fechaFin: { not: null } }),
    };

    const flitrosVentas = {
      tiendaId: tiendaId,
      totaltransfer: { gt: 0 },
      cierrePeriodo: {
        fechaFin: { not: null },
      },
      createdAt: {
        ...(fechaInicio && { gte: new Date(fechaInicio).toISOString() }),
        ...(fechaFin && { lte: nextDayToEndDate.toISOString() }),
      },
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
        const totalGananciaFinal = totalGananciaNeta - totalGastos;

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
    const ventasParaTotales = await prisma.venta.findMany({
      where: {
        tiendaId,
        cierrePeriodo: { fechaFin: { not: null } },
        createdAt: {
          ...(fechaInicio && { gte: new Date(fechaInicio).toISOString() }),
          ...(fechaFin && { lte: nextDayToEndDate.toISOString() }),
        },
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

    const sumTotalGananciasPropiasNet = cierresConMontos.reduce(
      (acc, c) => acc + Number(c.totalGananciasPropias || 0),
      0,
    );
    const sumTotalGananciasConsigNet = cierresConMontos.reduce(
      (acc, c) => acc + Number(c.totalGananciasConsignacion || 0),
      0,
    );
    const sumTotalGananciaNet = cierresConMontos.reduce(
      (acc, c) => acc + Number(c.totalGanancia || 0),
      0,
    );
    const sumTotalGastos = cierresConMontos.reduce(
      (acc, c) => acc + Number((c as CierreResumenExt).totalGastos || 0),
      0,
    );
    const sumTotalGananciaFinal = cierresConMontos.reduce(
      (acc, c) =>
        acc +
        Number(
          (c as CierreResumenExt).totalGananciaFinal ?? c.totalGanancia ?? 0,
        ),
      0,
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
