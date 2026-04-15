import { CreateMoviento } from "@/lib/movimiento";
import { prisma } from "@/lib/prisma";
import { MovimientoTipo } from "@prisma/client";
import { NextResponse } from "next/server";
import {startOfNextDay} from "@/utils/date";

export async function GET(req: Request) {
  try {
    
    const { searchParams } = new URL(req.url);

    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const tiendaId = searchParams.get("tiendaId");
    const fechaInicio = searchParams.get("fechaInicio");
    const fechaFin = searchParams.get("fechaFin");
    const tipoRaw = searchParams.get("tipo");
    const tipos: MovimientoTipo[] = tipoRaw
      ? (tipoRaw.split(",").filter(Boolean) as MovimientoTipo[])
      : [];
    const productoTiendaId = searchParams.get("productoTiendaId");
    const referenciaId = searchParams.get("referenciaId");
    const search = searchParams.get("search");

    // Obtener IDs coincidentes con búsqueda tolerante a tildes/mayúsculas usando unaccent
    let searchIds: string[] | undefined;
    if (search) {
      const normalizedSearch = search.trim().replace(/\s+/g, ' ');
      const pattern = `%${normalizedSearch}%`;
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT ms.id
        FROM "MovimientoStock" ms
        LEFT JOIN "ProductoTienda" pt ON ms."productoTiendaId" = pt.id
        LEFT JOIN "Producto" p ON pt."productoId" = p.id
        LEFT JOIN "Usuario" u ON ms."usuarioId" = u.id
        LEFT JOIN "Proveedor" prov ON ms."proveedorId" = prov.id
        WHERE ms."tiendaId" = ${tiendaId}
          AND (
            unaccent(lower(COALESCE(ms.motivo, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(p.nombre, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(u.nombre, '')))    LIKE unaccent(lower(${pattern}))
            OR unaccent(lower(COALESCE(prov.nombre, ''))) LIKE unaccent(lower(${pattern}))
          )
      `;
      searchIds = rows.map(r => r.id);
    }

    const filtros = {
      ...(fechaInicio && {fecha: { gte: new Date(fechaInicio).toISOString() }}),
      ...(fechaFin && {fecha: {lte: startOfNextDay(new Date(fechaFin)).toISOString()}}),
      ...(tipos.length === 1 && { tipo: tipos[0] }),
      ...(tipos.length > 1 && { tipo: { in: tipos } }),
      ...(productoTiendaId && {productoTiendaId: productoTiendaId}),
      ...(referenciaId && {referenciaId: referenciaId}),
      ...(searchIds && { id: { in: searchIds } }),
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

    // 🆕 Retornar objeto con data y total
    return NextResponse.json({
      data: movimientos,
      total: total
    }, {status: 200});
  } catch (error) {
    console.error(error);
    
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
    console.error(error);
    
    return NextResponse.json(
      { error: "Error al crear movimiento" },
      { status: 500 }
    );
  }
}