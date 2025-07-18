import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";
import { MovimientoTipo } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string, tiendaId: string }> }) {
  try {
    
    const { tipo, tiendaId } = await params;
    const { searchParams } = new URL(req.url);
    const take = Number.parseInt(searchParams.get("take") || "20");
    const skip = Number.parseInt(searchParams.get("skip") || "0");
    const tipoMovimiento = searchParams.get("tipo") || "";
    const proveedorId = searchParams.get("proveedorId") || "";
    const text = searchParams.get("text") || "";
    const categoriaId = searchParams.get("categoriaId") || "";
    
    
    
    const user = await getUserFromRequest(req);
    const negocioId = user?.negocio.id;
    
    const whereProductoTienda = {
      tiendaId: tiendaId,
      
      ...(tipoMovimiento === 'CONSIGNACION_ENTRADA' ? {proveedorId: proveedorId} : {proveedorId: null})

    }

    if(tipo.toUpperCase() === 'ENTRADA') {
      const productos = await prisma.producto.findMany({
        where: {
          negocioId: negocioId,
          fraccionDeId: null,

          ...(text && {nombre: { contains: text, mode: 'insensitive' }
          }),
          ...(categoriaId && {
            categoriaId: categoriaId
          })
        },
        include: {
          categoria: true,
          productosTienda: {
            where: whereProductoTienda,
          }
        },
        take,
        skip,
        orderBy: {
          nombre: 'asc'
        }
      });

      return NextResponse.json(productos, {status: 200});

    } else if(tipo.toUpperCase() === 'SALIDA') {
      const productos = await prisma.producto.findMany({
        where: {
          negocioId: negocioId,
          fraccionDeId: null,
          ...(text && {
            OR: [
              { nombre: { contains: text, mode: 'insensitive' } },
              {
                productosTienda: {
                  some: {
                    proveedor: {
                      nombre: { contains: text, mode: 'insensitive' }
                    }
                  }
                }
              }
            ]
          }),
          ...(categoriaId && {
            categoriaId: categoriaId
          }),
          
          productosTienda: {  
            some: {
              tiendaId: tiendaId,
              existencia: {
                gt: 0
              }
            },  
          }
        },
        include: {
          categoria: true,
          productosTienda: {
            where: {
              tiendaId: tiendaId,
            },
            include: {
              proveedor: true
            }
          }
        },
        take,
        skip,
        orderBy: {
          nombre: 'asc'
        }
      });

      return NextResponse.json(productos, {status: 200});
    } else {
      return NextResponse.json({error: 'Tipo de movimiento no válido'}, {status: 400});
    }
  } catch (error) {
    console.log(error);
    
    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 }
    );
  }
}