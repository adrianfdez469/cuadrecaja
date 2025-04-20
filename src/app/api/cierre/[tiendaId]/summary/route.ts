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

    const totales = await prisma.cierrePeriodo.aggregate({
      _sum: {
        totalGanancia: true,
        totalInversion: true,
        totalVentas: true,
        totalTransferencia: true
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
      totalItems: totalCierres
    });
  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener los datos del cierre" }, { status: 500 });
  }
}
