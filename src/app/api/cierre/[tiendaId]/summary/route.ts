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
    
    return NextResponse.json({
      cierres: cierres, 
      sumTotalGanancia: totales._sum.totalGanancia,
      sumTotalInversion: totales._sum.totalInversion,
      sumTotalVentas: totales._sum.totalVentas,
      sumTotalTransferencia: totales._sum.totalTransferencia,
      desgloseTransferencias: transferenciasConNombres,
      sumTotalVentasPropias: totales._sum.totalVentasPropias,
      sumTotalVentasConsignacion: totales._sum.totalVentasConsignacion,
      sumTotalGananciasPropias: totales._sum.totalGananciasPropias,
      sumTotalGananciasConsignacion: totales._sum.totalGananciasConsignacion,
      totalItems: totalCierres
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
