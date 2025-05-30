import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateMoviento } from "@/lib/movimiento";
import { IVenta } from "@/types/IVenta";

// Crear una venta
export async function POST(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    const { cierreId, tiendaId } = await params;
    
    console.log('🔍 [POST /api/venta] Recibiendo petición de venta:', {
      tiendaId,
      cierreId
    });

    const { usuarioId, productos, total, totalcash, totaltransfer, syncId } = await req.json();

    console.log('🔍 [POST /api/venta] Datos de la venta:', {
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      syncId,
      productos
    });

    if (!tiendaId || !usuarioId || !cierreId || !productos.length) {
      console.error('❌ [POST /api/venta] Datos insuficientes:', {
        tiendaId,
        usuarioId,
        cierreId,
        productosLength: productos.length
      });
      return NextResponse.json({ error: "Datos insuficientes para crear la venta" }, { status: 400 });
    }

    // Buscar el último período abierto
    const periodoActual = await prisma.cierrePeriodo.findUnique({
      where: {
        id: cierreId
      }
    });

    console.log('🔍 [POST /api/venta] Período actual:', periodoActual);

    const existeVenta = syncId ? await prisma.venta.findFirst({
      where: {
        syncId: syncId
      }
    }) : false;

    console.log('🔍 [POST /api/venta] Verificando venta existente:', {
      syncId,
      existeVenta: !!existeVenta
    });

    if(!existeVenta) {
      console.log('🔍 [POST /api/venta] Creando nueva venta...');

      // Verificar que todos los productos existen
      const productosExistentes = await prisma.productoTienda.findMany({
        where: {
          id: {
            in: productos.map(p => p.productoTiendaId)
          }
        },
        select: {
          id: true,
          productoId: true
        }
      });

      console.log('🔍 [POST /api/venta] Productos encontrados en DB:', productosExistentes);

      const productosNoEncontrados = productos.filter(
        p => !productosExistentes.some(pe => pe.id === p.productoTiendaId)
      );

      if (productosNoEncontrados.length > 0) {
        console.error('❌ [POST /api/venta] Productos no encontrados:', productosNoEncontrados);
        return NextResponse.json({ 
          error: "Algunos productos no existen en la tienda",
          productosNoEncontrados 
        }, { status: 400 });
      }

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
            create: productos.map((p) => ({
              productoTiendaId: p.productoTiendaId,
              cantidad: p.cantidad,
              id: p.id
            })),
          },
        },
      });

      console.log('🔍 [POST /api/venta] Venta creada exitosamente:', venta);
  
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

      console.log('🔍 [POST /api/venta] Productos fraccionables encontrados:', productosFraccionablesData);
  
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
      console.log('🔍 [POST /api/venta] Venta ya existe, retornando:', existeVenta);
      return NextResponse.json(existeVenta, { status: 201 });
    }
  } catch (error) {
    console.error('❌ [POST /api/venta] Error al crear la venta:', error);
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
                    id: true,
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
        id: p.producto.producto.id,
        ventaId: venta.id,
        productoTiendaId: p.productoTiendaId,
        cantidad: p.cantidad,
        name: p.producto?.producto?.nombre ?? undefined,
        price: p.producto?.precio ?? undefined
      })),
      syncId: venta.syncId
    }));

    return NextResponse.json(ventas);

  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 });
  }
}

