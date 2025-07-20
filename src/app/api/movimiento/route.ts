import { CreateMoviento } from "@/lib/movimiento";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    
    const { searchParams } = new URL(req.url);

    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const tiendaId = searchParams.get("tiendaId");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const tipo = searchParams.get("tipo") as MovimientoTipo;
    const productoTiendaId = searchParams.get("productoTiendaId");
    const referenciaId = searchParams.get("referenciaId");
    const search = searchParams.get("search");

    const filtros = {
      ...(fechaInicio && {fecha: { gte: new Date(fechaInicio).toISOString() }}),
      ...(fechaFin && {fecha: {lte: new Date(fechaFin).toISOString()}}),
      ...(tipo && {tipo: tipo}),
      ...(productoTiendaId && {productoTiendaId: productoTiendaId}),
      ...(referenciaId && {referenciaId: referenciaId})
    }

    // 🆕 Obtener el total de registros para paginación
    const total = await prisma.movimientoStock.count({
      where: {
        tiendaId: tiendaId,
        ...filtros,
        
      }
    });

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        tiendaId: tiendaId,
        ...filtros 
      },
      include: {
        proveedor: true,
        productoTienda: {
          include: {
            producto: {
              select: {
                nombre: true,
                
              }
            },
            proveedor: true,
          }
        },
        usuario: {
          select: {
            nombre: true
          }
        }
      },
      take: take,
      skip: skip,
      orderBy: {
        fecha: 'desc'
      }
    })

    // 🆕 Filtrar por término de búsqueda en el frontend si es necesario
    let filteredMovimientos = movimientos;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredMovimientos = movimientos.filter(movimiento => 
        movimiento.tipo.toLowerCase().includes(searchLower) ||
        movimiento.productoTienda?.producto?.nombre?.toLowerCase().includes(searchLower) ||
        movimiento.usuario?.nombre?.toLowerCase().includes(searchLower) ||
        movimiento.proveedor?.nombre?.toLowerCase().includes(searchLower)
      );
    }

    // 🆕 Retornar objeto con data y total
    return NextResponse.json({
      data: filteredMovimientos,
      total: search ? filteredMovimientos.length : total
    }, {status: 200});
  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {

  try {
    const { data, items } = await req.json();

    await CreateMoviento(data, items);

    return NextResponse.json({}, {status: 201});

  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al crear movimiento" },
      { status: 500 }
    );
  }
}