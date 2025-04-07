import { prisma } from "@/lib/prisma";
import { IMovimiento } from "@/types/IMovimiento";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
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

    const filtros = {
      ...(fechaInicio && {fecha: { gte: new Date(fechaInicio).toISOString() }}),
      ...(fechaFin && {fecha: {lte: new Date(fechaFin).toISOString()}}),
      ...(tipo && {tipo: tipo}),
      ...(productoTiendaId && {productoTiendaId: productoTiendaId}),
      ...(referenciaId && {referenciaId: referenciaId})
    }

    const movimientos = await prisma.movimientoStock.findMany({
      where: {
        tiendaId: tiendaId,
        ...filtros 
      },
      include: {
        productoTienda: {
          include: {
            producto: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      take: take,
      skip: skip,
      orderBy: {
        fecha: 'desc'
      }
    })

    return NextResponse.json(movimientos, {status: 200});
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

    const { tipo, tiendaId, usuarioId } = data;

    const transaction = await prisma.$transaction(async (tx) => {
      for (const movimiento of items) {
        const {  productoId, cantidad } = movimiento;
  
        // 1. Upsert para obtener (o crear) el productoTienda
        const productoTienda = await tx.productoTienda.upsert({
          where: {
            tiendaId_productoId: {
              tiendaId,
              productoId,
            },
          },
          create: {
            tiendaId,
            productoId,
            costo: 0, // si tienes valores personalizados, agrégalos aquí
            precio: 0,
            existencia: cantidad,
          },
          update: {
            existencia: {
              increment: isMovimientoBaja(tipo) ? -cantidad : cantidad,
            },
          },
        });
  
        // 2. Crear el movimiento con el ID del productoTienda
        await tx.movimientoStock.create({
          data: {
            tipo,
            cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId,
            usuarioId,
          },
        });
      }
    });

    return NextResponse.json({}, {status: 201});

  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al crear movimiento" },
      { status: 500 }
    );
  }
}