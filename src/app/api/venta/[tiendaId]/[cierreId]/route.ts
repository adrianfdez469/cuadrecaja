
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateMoviento } from "@/lib/movimiento";

// Crear una venta
export async function POST(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    
    const { cierreId, tiendaId } = await params;
    
    const { usuarioId, productos, total, totalcash, totaltransfer } = await req.json();

    if (!tiendaId || !usuarioId || !cierreId || !productos.length) {
      return NextResponse.json({ error: "Datos insuficientes para crear la venta" }, { status: 400 });
    }

    // Buscar el último período abierto
    const periodoActual = await prisma.cierrePeriodo.findUnique({
      where: {
        id: cierreId
      }
    });

    // Revisar si en la venta hay productos fraccionables
    const productosFraccionablesData = await prisma.productoTienda.findMany({
      where: {
        AND: {
          id:{
             in: productos.map(p => p.productoTiendaId)
          },
          producto: {
            fraccionDeId: {
              not: {
                equals: null
              }
            }
          }
        }        
      },
      include: {
        producto: {
          select: {
            fraccionDeId: true,
            unidadesPorFraccion: true,
            
          }
        }
      },
    });

    // En caso que los haya, revisar que la cantidad solicitada está en existencia
    if(productosFraccionablesData.length > 0) {

     

      const productosFraccionablesNeedDesagregateData = productosFraccionablesData
        .filter((prodFracc) => {
          const prod = productos.find(p => p.productoTiendaId === prodFracc.id);
          if(prod) {
            if(prodFracc.producto.unidadesPorFraccion <= prod.cantidad) {
              throw Error(`Vendes mas unidades sueltas de las que lleva una caja en una misma venta`)
            }
            return prodFracc.existencia < prod.cantidad;
          } else {
            return false;
          }
        });
      const itemsDesagregaciónBaja = [];
      const itemsDesagregaciónAlta = [];

      productosFraccionablesNeedDesagregateData.forEach((item) => {
        
        itemsDesagregaciónAlta.push({
          cantidad: item.producto.unidadesPorFraccion,
          productoId: item.productoId
        })
        itemsDesagregaciónBaja.push({
          cantidad: 1,
          productoId: item.producto.fraccionDeId
        })
      });

      if(itemsDesagregaciónBaja.length > 0){
        await CreateMoviento({
          tipo: "DESAGREGACION_BAJA",
          tiendaId: tiendaId,
          usuarioId: usuarioId
        }, itemsDesagregaciónBaja);
      }

      if(itemsDesagregaciónAlta.length > 0) {
        await CreateMoviento({
          tipo: "DESAGREGACION_ALTA",
          tiendaId: tiendaId,
          usuarioId: usuarioId
        }, itemsDesagregaciónAlta);
      }

    }

    const venta = await prisma.venta.create({
      data: {
        tiendaId,
        usuarioId,
        total,
        totalcash,
        totaltransfer,
        cierrePeriodoId: periodoActual?.id || null,
        productos: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: productos.map((p: any) => ({
            productoTiendaId: p.productoTiendaId,
            cantidad: p.cantidad,
          })),
        },
      },
    });

    return NextResponse.json({}, { status: 201 });
  } catch (error) {
    console.log(error);
    
    return NextResponse.json({ error: "Error al crear la venta" }, { status: 500 });
  }
}

