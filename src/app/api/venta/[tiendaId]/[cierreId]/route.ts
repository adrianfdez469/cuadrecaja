import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IVenta } from "@/types/IVenta";

// Crear una venta
export async function POST(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    const { cierreId, tiendaId } = await params;
    
    console.log('🔍 [POST /api/venta] Recibiendo petición de venta:', {
      tiendaId,
      cierreId
    });

    const { usuarioId, productos, total, totalcash, totaltransfer, syncId, transferDestinationId } = await req.json();

    console.log('🔍 [POST /api/venta] Datos de la venta:', {
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      syncId,
      productos,
      transferDestinationId
    });

    if (!tiendaId || !usuarioId || !cierreId || !productos.length || !syncId) {
      console.error('❌ [POST /api/venta] Datos insuficientes:', {
        tiendaId,
        usuarioId,
        cierreId,
        productosLength: productos.length,
        syncId
      });
      return NextResponse.json({ error: "Datos insuficientes para crear la venta" }, { status: 400 });
    }

    // Verificar si ya existe una venta con este syncId (idempotencia)
    const existeVenta = await prisma.venta.findFirst({
      where: {
        syncId: syncId
      },
      include: {
        productos: true
      }
    });

    console.log('🔍 [POST /api/venta] Verificando venta existente:', {
      syncId,
      existeVenta: !!existeVenta
    });

    if (existeVenta) {
      console.log('🔍 [POST /api/venta] Venta ya existe, retornando:', existeVenta);
      return NextResponse.json(existeVenta, { status: 200 });
    }

    // Buscar el período
    const periodoActual = await prisma.cierrePeriodo.findUnique({
      where: {
        id: cierreId
      }
    });

    console.log('🔍 [POST /api/venta] Período actual:', periodoActual);

    if (!periodoActual) {
      return NextResponse.json({ error: "Período no encontrado" }, { status: 404 });
    }

    // **TRANSACCIÓN ATÓMICA: Todo o nada**
    const result = await prisma.$transaction(async (tx) => {
      console.log('🔍 [POST /api/venta] Iniciando transacción atómica...');

      // 1. Verificar que todos los productos existen
      const productosExistentes = await tx.productoTienda.findMany({
        where: {
          id: {
            in: productos.map(p => p.productoTiendaId)
          }
        },
        select: {
          id: true,
          productoId: true,
          existencia: true,
          costo: true,
          precio: true,
          proveedorId: true
        }
      });

      console.log('🔍 [POST /api/venta] Productos encontrados en DB:', productosExistentes);

      const productosNoEncontrados = productos.filter(
        p => !productosExistentes.some(pe => pe.id === p.productoTiendaId)
      );

      if (productosNoEncontrados.length > 0) {
        console.error('❌ [POST /api/venta] Productos no encontrados:', productosNoEncontrados);
        throw new Error(`Productos no encontrados: ${productosNoEncontrados.map(p => p.name).join(', ')}`);
      }

      const productosMegrados = productosExistentes.map((p) => {
        const producto = productos.find((p2) => p2.productoTiendaId === p.id);
        return {
          ...p,
          ...producto
        };
      });

      // 2. Crear la venta
      const venta = await tx.venta.create({
        data: {
          tiendaId,
          usuarioId,
          total,
          totalcash,
          totaltransfer,
          cierrePeriodoId: periodoActual.id,
          syncId,
          productos: {
            create: productosMegrados.map((p) => ({
              productoTiendaId: p.productoTiendaId,
              cantidad: p.cantidad,
              costo: p.costo,
              precio: p.precio
            })),
          },
          ...(transferDestinationId && {transferDestinationId: transferDestinationId}),
        },
        include: {
          productos: true
        }
      });

      console.log('🔍 [POST /api/venta] Venta creada:', venta.id);

      // 3. Crear movimientos de stock y actualizar existencias
      for (const producto of productos) {
        const productoTienda = productosExistentes.find(p => p.id === producto.productoTiendaId);
        if (!productoTienda) continue;

        const existenciaAnterior = productoTienda.existencia;

        // Actualizar existencia
        await tx.productoTienda.update({
          where: { id: producto.productoTiendaId },
          data: {
            existencia: {
              decrement: producto.cantidad
            }
          }
        });

        // Crear movimiento de venta
        await tx.movimientoStock.create({
          data: {
            tipo: 'VENTA',
            cantidad: producto.cantidad,
            productoTiendaId: producto.productoTiendaId,
            tiendaId,
            usuarioId,
            existenciaAnterior,
            referenciaId: venta.id,
            motivo: `Venta ${venta.id}`,
            ...(productoTienda.proveedorId && {proveedorId: productoTienda.proveedorId})
          }
        });

        console.log(`🔍 [POST /api/venta] Movimiento creado para producto ${producto.productoTiendaId}: -${producto.cantidad}`);
      }

      // 4. Manejar productos fraccionables (si aplica)
      const productosFraccionables = await tx.productoTienda.findMany({
        where: {
          id: {
            in: productos.map(p => p.productoTiendaId)
          },
          producto: {
            fraccionDeId: {
              not: null
            }
          }
        },
        include: {
          producto: {
            select: {
              fraccionDeId: true,
              unidadesPorFraccion: true
            }
          }
        }
      });

      if (productosFraccionables.length > 0) {
        console.log('🔍 [POST /api/venta] Procesando productos fraccionables:', productosFraccionables.length);

        const productosFraccionablesData = productosFraccionables.filter(pf => pf.producto.fraccionDeId);
        
        const productosFraccionablesNeedDesagregateData = productosFraccionablesData
          .filter((prodFracc) => {
            const prod = productos.find(p => p.productoTiendaId === prodFracc.id);
            if (prod) {
              if (prodFracc.producto.unidadesPorFraccion <= prod.cantidad) {
                throw new Error(`Vendes más unidades sueltas de las que lleva una caja en una misma venta`);
              }
              return prodFracc.existencia < prod.cantidad;
            }
            return false;
          });

        const itemsDesagregaciónBaja = [];
        const itemsDesagregaciónAlta = [];

        productosFraccionablesNeedDesagregateData.forEach((item) => {
          itemsDesagregaciónAlta.push({
            cantidad: item.producto.unidadesPorFraccion,
            productoId: item.productoId
          });
          itemsDesagregaciónBaja.push({
            cantidad: 1,
            productoId: item.producto.fraccionDeId
          });
        });

        // Crear movimientos de desagregación dentro de la misma transacción
        if (itemsDesagregaciónBaja.length > 0) {
          for (const item of itemsDesagregaciónBaja) {
            const productoTiendaDesagregar = await tx.productoTienda.findFirst({
              where: {
                tiendaId,
                productoId: item.productoId,
                proveedorId: null // Solo productos propios para desagregación
              }
            });

            if (productoTiendaDesagregar) {
              const existenciaAnterior = productoTiendaDesagregar.existencia;

              await tx.productoTienda.update({
                where: { id: productoTiendaDesagregar.id },
                data: {
                  existencia: {
                    decrement: item.cantidad
                  }
                }
              });

              await tx.movimientoStock.create({
                data: {
                  tipo: "DESAGREGACION_BAJA",
                  cantidad: item.cantidad,
                  productoTiendaId: productoTiendaDesagregar.id,
                  tiendaId,
                  usuarioId,
                  existenciaAnterior,
                  referenciaId: venta.id
                }
              });
            }
          }
        }

        if (itemsDesagregaciónAlta.length > 0) {
          for (const item of itemsDesagregaciónAlta) {
            const productoTiendaAgregar = await tx.productoTienda.findFirst({
              where: {
                tiendaId,
                productoId: item.productoId,
                proveedorId: null // Solo productos propios para desagregación
              }
            });

            if (productoTiendaAgregar) {
              const existenciaAnterior = productoTiendaAgregar.existencia;

              await tx.productoTienda.update({
                where: { id: productoTiendaAgregar.id },
                data: {
                  existencia: {
                    increment: item.cantidad
                  }
                }
              });

              await tx.movimientoStock.create({
                data: {
                  tipo: "DESAGREGACION_ALTA",
                  cantidad: item.cantidad,
                  productoTiendaId: productoTiendaAgregar.id,
                  tiendaId,
                  usuarioId,
                  existenciaAnterior,
                  referenciaId: venta.id
                }
              });
            }
          }
        }
      }

      console.log('🔍 [POST /api/venta] Transacción completada exitosamente');
      return venta;
    });

    console.log('🔍 [POST /api/venta] Venta y movimientos creados exitosamente:', result.id);
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    console.error('❌ [POST /api/venta] Error en transacción:', error);
    return NextResponse.json(
      { error: error.message || "Error al crear la venta" },
      { status: 500 }
    );
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
            precio: true,
            costo: true,

            
            producto: {
              select: {
                proveedor: {
                  select: {
                    id: true,
                    nombre: true
                  }
                },
                producto: {
                  select: {
                    nombre: true,
                    id: true,
                  }
                },
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
        name: p.producto.proveedor ? `${p.producto?.producto?.nombre} - ${p.producto.proveedor.nombre}` : p.producto?.producto?.nombre ?? undefined,
        price: p.precio ?? undefined
      })),
      syncId: venta.syncId
    }));

    return NextResponse.json(ventas);

  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 });
  }
}

