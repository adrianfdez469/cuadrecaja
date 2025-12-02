import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ISummaryCierre } from "@/types/ICierre";


export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId }> }): 
Promise<NextResponse<ISummaryCierre | {error: string}>> {
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
    let cierresConMontos = [...cierres];
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
      const mapMontos: Record<string, { bruto: number; descuentos: number }> = {};
      for (const v of ventasPorCierre) {
        const bruto = (v.productos || []).reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
        const desc = Number((v as any).discountTotal || 0);
        if (!mapMontos[v.cierrePeriodoId]) mapMontos[v.cierrePeriodoId] = { bruto: 0, descuentos: 0 };
        mapMontos[v.cierrePeriodoId].bruto += bruto;
        mapMontos[v.cierrePeriodoId].descuentos += desc;
      }
      // Mezclar con cierres
      cierresConMontos = cierres.map(c => ({
        ...c,
        // @ts-ignore: campos adicionales para el resumen
        totalVentasBrutas: mapMontos[c.id]?.bruto || 0,
        // @ts-ignore
        totalDescuentos: mapMontos[c.id]?.descuentos || 0,
      }));
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
    const sumTotalDescuentos = ventasParaTotales.reduce((acc, v) => acc + Number((v as any).discountTotal || 0), 0);
    const sumTotalVentasBrutas = ventasParaTotales.reduce((acc, v) => acc + (v.productos || []).reduce((a, p) => a + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0), 0);
    
    return NextResponse.json({
      cierres: cierresConMontos as any, 
      sumTotalGanancia: totales._sum.totalGanancia,
      sumTotalInversion: totales._sum.totalInversion,
      sumTotalVentas: totales._sum.totalVentas,
      sumTotalTransferencia: totales._sum.totalTransferencia,
      desgloseTransferencias: transferenciasConNombres,
      sumTotalVentasPropias: totales._sum.totalVentasPropias,
      sumTotalVentasConsignacion: totales._sum.totalVentasConsignacion,
      sumTotalGananciasPropias: totales._sum.totalGananciasPropias,
      sumTotalGananciasConsignacion: totales._sum.totalGananciasConsignacion,
      sumTotalVentasBrutas,
      sumTotalDescuentos,
      totalItems: totalCierres
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
