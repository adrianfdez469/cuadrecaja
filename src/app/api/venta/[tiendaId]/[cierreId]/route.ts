
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateMoviento } from "@/lib/movimiento";
import { IVenta } from "@/types/IVenta";

// Crear una venta
export async function POST(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    
    const { cierreId, tiendaId } = await params;
    
    const { usuarioId, productos, total, totalcash, totaltransfer, syncId } = await req.json();

    if (!tiendaId || !usuarioId || !cierreId || !productos.length) {
      return NextResponse.json({ error: "Datos insuficientes para crear la venta" }, { status: 400 });
    }

    // Buscar el último período abierto
    const periodoActual = await prisma.cierrePeriodo.findUnique({
      where: {
        id: cierreId
      }
    });

    const existeVenta = syncId ? await prisma.venta.findFirst({
      where: {
        syncId: syncId
      }
    }) : false;

    if(!existeVenta) {
      const venta = await prisma.venta.create({
        data: {
          tiendaId,
          usuarioId,
          total,
          totalcash,
          totaltransfer,
          cierrePeriodoId: periodoActual?.id || null,
          syncId,
          productos: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: productos.map((p: any) => ({
              productoTiendaId: p.productoTiendaId,
              cantidad: p.cantidad,
            })),
          },
        },
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
            usuarioId: usuarioId,
            referenciaId: venta.id
            
          }, itemsDesagregaciónBaja);
        }
  
        if(itemsDesagregaciónAlta.length > 0) {
          await CreateMoviento({
            tipo: "DESAGREGACION_ALTA",
            tiendaId: tiendaId,
            usuarioId: usuarioId,
            referenciaId: venta.id
          }, itemsDesagregaciónAlta);
        }
  
      }
      
      return NextResponse.json(venta, { status: 201 });
    } else {
      return NextResponse.json(existeVenta, { status: 201 });
    }
  } catch (error) {
    console.log(error);
    
    return NextResponse.json({ error: "Error al crear la venta" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    const { cierreId, tiendaId } = await params;

    const ventasPrisma = await prisma.venta.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            nombre: true
          }
        },
        productos: {
          select: {
            cantidad: true,
            id: true,
            productoTiendaId: true,
            producto: {
              select: {
                producto: {
                  select: {
                    nombre: true,
                  }
                },
                precio: true
              }
            }
          },
        }
      },
      where: {
        cierrePeriodoId: cierreId,
        tiendaId: tiendaId
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const ventas: IVenta[] = ventasPrisma.map((venta) => ({
      id: venta.id,
      createdAt: venta.createdAt,
      total: venta.total,
      totalcash: venta.totalcash,
      totaltransfer: venta.totaltransfer,
      tiendaId: venta.tiendaId,
      usuarioId: venta.usuarioId,
      cierrePeriodoId: venta.cierrePeriodoId,
      usuario: {
        id: venta.usuario.id,
        nombre: venta.usuario.nombre,
        usuario: "",
        rol: ""
      },
      productos: venta.productos.map((p) => ({
        id: p.id,
        ventaId: venta.id,
        productoTiendaId: p.productoTiendaId,
        cantidad: p.cantidad,
        name: p.producto?.producto?.nombre ?? undefined,
        price: p.producto?.precio ?? undefined
      }))
    }));

    return NextResponse.json(ventas);

  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 });
  }
}

