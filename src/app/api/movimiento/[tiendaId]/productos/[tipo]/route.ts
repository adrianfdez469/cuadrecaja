import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";
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

    // Búsqueda tolerante a tildes/mayúsculas/espacios usando unaccent
    let textFilterIds: string[] | undefined;
    if (text) {
      const normalizedText = text.trim().replace(/\s+/g, ' ');
      const pattern = `%${normalizedText}%`;

      if (tipo.toUpperCase() === 'ENTRADA') {
        const rows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Producto"
          WHERE "negocioId" = ${negocioId}
            AND "deletedAt" IS NULL
            AND unaccent(lower(nombre)) LIKE unaccent(lower(${pattern}))
        `;
        textFilterIds = rows.map(r => r.id);
      } else {
        const rows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT DISTINCT p.id
          FROM "Producto" p
          LEFT JOIN "ProductoTienda" pt ON pt."productoId" = p.id AND pt."tiendaId" = ${tiendaId}
          LEFT JOIN "Proveedor" prov ON pt."proveedorId" = prov.id
          WHERE p."negocioId" = ${negocioId}
            AND p."deletedAt" IS NULL
            AND (
              unaccent(lower(p.nombre)) LIKE unaccent(lower(${pattern}))
              OR unaccent(lower(COALESCE(prov.nombre, ''))) LIKE unaccent(lower(${pattern}))
            )
        `;
        textFilterIds = rows.map(r => r.id);
      }
    }

    const whereProductoTienda = {
      tiendaId: tiendaId,

      ...(tipoMovimiento === 'CONSIGNACION_ENTRADA' ? {proveedorId: proveedorId} : {proveedorId: null})

    }

    if(tipo.toUpperCase() === 'ENTRADA') {
      const productos = await prisma.producto.findMany({
        where: {
          negocioId: negocioId,
          deletedAt: null,
          ...(textFilterIds && { id: { in: textFilterIds } }),
          ...(categoriaId && {
            categoriaId: categoriaId
          })
        },
        include: {
          categoria: true,
          productosTienda: {
            where: whereProductoTienda,
            include: {
              proveedor: true
            }
          },
          codigosProducto: {
            select: {
              codigo: true
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

    } else if(tipo.toUpperCase() === 'SALIDA') {

      const whereProductoTienda = {
        tiendaId: tiendaId,
        existencia: {
          gt: 0
        },
        ...(proveedorId && {proveedorId: proveedorId})
      }

      const productos = await prisma.producto.findMany({
        where: {
          negocioId: negocioId,
          deletedAt: null,
          ...(textFilterIds && { id: { in: textFilterIds } }),
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
            where: whereProductoTienda,
            include: {
              proveedor: true
            }
          },
          codigosProducto: {
            select: {
              codigo: true
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
    console.error(error);
    
    return NextResponse.json(
      { error: "Error al cargar movimiento" },
      { status: 500 }
    );
  }
}