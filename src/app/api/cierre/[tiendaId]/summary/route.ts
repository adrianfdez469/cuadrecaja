import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISummaryCierre } from "@/types/ICierre";

type Params = { tiendaId: string };
type MontosMap = Record<string, { bruto: number; descuentos: number }>;
type CierreResumenExt = {
  id: string;
  totalGanancia?: number | null;
  totalGananciasPropias?: number | null;
  totalGananciasConsignacion?: number | null;
  totalVentasPropias?: number | null;
  totalVentasConsignacion?: number | null;
  // campos añadidos
  totalVentasBrutas?: number;
  totalDescuentos?: number;
} & Record<string, unknown>;


export async function GET(req: NextRequest, { params }: { params: Promise<Params> }):
  Promise<NextResponse<ISummaryCierre | { error: string }>> {
  try {
    
    const { tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin =  searchParams.get("fechaFin");

    const filtros = {
      tiendaId: tiendaId,
      ...(fechaInicio && {fechaInicio: { gte: new Date(fechaInicio).toISOString() }}),
      ...(fechaFin ? {fechaFin: {lte: new Date(fechaFin).toISOString()}} : {fechaFin: { not: null}})
    }

    const flitrosVentas = {
      tiendaId: tiendaId,
      totaltransfer: {gt: 0},
      cierrePeriodo: {
        fechaFin: { not: null }
      },
      createdAt: {
        ...(fechaInicio && {gte: new Date(fechaInicio).toISOString()}),
        ...(fechaFin && {lte: new Date(fechaFin).toISOString()})
      }
    }
  
    const cierres = await prisma.cierrePeriodo.findMany({
      where: {
        ...filtros
      },
      orderBy: {
        fechaInicio: 'desc',
        
      },
      take: take,
      skip: skip      
    });

    const totalCierres = await prisma.cierrePeriodo.count({
      where: {
        ...filtros
      }
    });

    const transferenciasDesglosadas = await prisma.venta.groupBy({
      by: ['transferDestinationId'],
      _sum: {
        totaltransfer: true,
      },
      where: {
        ...flitrosVentas
      }
    })

    // Resolver nombres de destinos de transferencia
    const destinationIds = transferenciasDesglosadas
      .map(item => item.transferDestinationId)
      .filter(id => id !== null);

    const destinationsNames = await prisma.transferDestinations.findMany({
      where: {
        id: { in: destinationIds }
      },
      select: {
        id: true,
        nombre: true
      }
    });

    // Combinar datos con nombres
    const transferenciasConNombres = transferenciasDesglosadas.map(item => ({
      ...item,
      destinationName: destinationsNames.find(dest => dest.id === item.transferDestinationId)?.nombre || 'Sin nombre'
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
        totalGananciasConsignacion: true
      },
      where: {
        ...filtros
      }
    });

    // Calcular, para cada cierre en la página, los montos brutos y descuentos
    const cierresIds = cierres.map(c => c.id);
    let cierresConMontos: CierreResumenExt[] = [...(cierres as CierreResumenExt[])];
    if (cierresIds.length > 0) {
      const ventasPorCierre = await prisma.venta.findMany({
        where: { cierrePeriodoId: { in: cierresIds }, tiendaId },
        select: {
          id: true,
          discountTotal: true,
          cierrePeriodoId: true,
          productos: { select: { cantidad: true, precio: true } }
        }
      });
      const mapMontos: MontosMap = {};
      for (const v of ventasPorCierre) {
        const bruto = (v.productos || []).reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
        const desc = Number(v.discountTotal ?? 0);
        if (!mapMontos[v.cierrePeriodoId]) mapMontos[v.cierrePeriodoId] = { bruto: 0, descuentos: 0 };
        mapMontos[v.cierrePeriodoId].bruto += bruto;
        mapMontos[v.cierrePeriodoId].descuentos += desc;
      }
      // Mezclar con cierres y además recalcular ganancias NETAS por cierre considerando descuentos
      cierresConMontos = cierres.map((c) => {
        // Bruto y descuentos calculados
        const totalVentasBrutas = mapMontos[c.id]?.bruto || 0;
        const totalDescuentos = mapMontos[c.id]?.descuentos || 0;

        // Datos base guardados en el cierre
        const ventasPropias = Number((c as CierreResumenExt).totalVentasPropias || 0);
        const ventasConsignacion = Number((c as CierreResumenExt).totalVentasConsignacion || 0);
        const gananciasPropias = Number((c as CierreResumenExt).totalGananciasPropias || 0);
        const gananciasConsignacion = Number((c as CierreResumenExt).totalGananciasConsignacion || 0);

        // Prorrateo de descuentos por tipo en función del bruto
        let descuentoPropias = 0;
        let descuentoConsignacion = 0;
        if (totalVentasBrutas > 0 && totalDescuentos > 0) {
          const ratioPropias = Math.max(0, Math.min(1, ventasPropias / totalVentasBrutas));
          const ratioConsig = Math.max(0, Math.min(1, ventasConsignacion / totalVentasBrutas));
          descuentoPropias = totalDescuentos * ratioPropias;
          descuentoConsignacion = totalDescuentos * ratioConsig;
        }

        // Ganancias netas por tipo (no negativas)
        const totalGananciasPropiasNet = Math.max(0, (gananciasPropias || 0) - (descuentoPropias || 0));
        const totalGananciasConsignacionNet = Math.max(0, (gananciasConsignacion || 0) - (descuentoConsignacion || 0));
        const totalGananciaNeta = Math.max(0, totalGananciasPropiasNet + totalGananciasConsignacionNet);

        return {
          ...c,
          totalVentasBrutas,
          totalDescuentos,
          // Sobrescribir ganancias con valores NETOS (coherente con vista de cierre individual)
          totalGanancia: totalGananciaNeta,
          totalGananciasPropias: totalGananciasPropiasNet,
          totalGananciasConsignacion: totalGananciasConsignacionNet,
        } as CierreResumenExt;
      });
    }

    // Calcular agregados globales de bruto y descuentos dentro del rango/tienda
    const ventasParaTotales = await prisma.venta.findMany({
      where: {
        tiendaId,
        cierrePeriodo: { fechaFin: { not: null } },
        createdAt: {
          ...(fechaInicio && { gte: new Date(fechaInicio).toISOString() }),
          ...(fechaFin && { lte: new Date(fechaFin).toISOString() })
        }
      },
      select: {
        discountTotal: true,
        productos: { select: { cantidad: true, precio: true } }
      }
    });
    const sumTotalDescuentos = ventasParaTotales.reduce((acc, v) => acc + Number(v.discountTotal ?? 0), 0);
    const sumTotalVentasBrutas = ventasParaTotales.reduce((acc, v) => acc + (v.productos || []).reduce((a, p) => a + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0), 0);
    
    // Agregados de GANANCIAS NETAS: sumar desde los cierres ya ajustados
    const sumTotalGananciasPropiasNet = cierresConMontos.reduce((acc, c) => acc + Number(c.totalGananciasPropias || 0), 0);
    const sumTotalGananciasConsigNet = cierresConMontos.reduce((acc, c) => acc + Number(c.totalGananciasConsignacion || 0), 0);
    const sumTotalGananciaNet = cierresConMontos.reduce((acc, c) => acc + Number(c.totalGanancia || 0), 0);
    
    return NextResponse.json({
      cierres: cierresConMontos as unknown as ISummaryCierre["cierres"],
      // Ganancias NETAS del intervalo (ajustadas por descuentos)
      sumTotalGanancia: sumTotalGananciaNet,
      sumTotalInversion: totales._sum.totalInversion,
      sumTotalVentas: totales._sum.totalVentas,
      sumTotalTransferencia: totales._sum.totalTransferencia,
      desgloseTransferencias: transferenciasConNombres,
      sumTotalVentasPropias: totales._sum.totalVentasPropias,
      sumTotalVentasConsignacion: totales._sum.totalVentasConsignacion,
      // Totales de ganancias por tipo, NETOS tras prorratear descuentos
      sumTotalGananciasPropias: sumTotalGananciasPropiasNet,
      sumTotalGananciasConsignacion: sumTotalGananciasConsigNet,
      sumTotalVentasBrutas,
      sumTotalDescuentos,
      totalItems: totalCierres
    });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
