import {NextRequest, NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {IVenta} from "@/types/IVenta";
import { applyDiscountsForSale } from "@/lib/discounts";

// Crear una venta
export async function POST(req: NextRequest, { params }: { params: Promise<{ tiendaId: string, cierreId: string }> }) {
  try {
    const { cierreId, tiendaId } = await params;

    console.log('🔍 [POST /api/venta] Recibiendo petición de venta:', {
      tiendaId,
      cierreId
    });

    const {
      usuarioId,
      productos,
      total,
      totalcash,
      totaltransfer,
      transferDestinationId,

      syncId, // Id unico de transación y sincronización
      createdAt, // Fecha y hora real de la creación la venta en el frontend
      wasOffline, // El intento de venta fue realizado sin conexión?
      syncAttempts, // Cantidad de reintentos alcanzados 
      discountCodes // 🆕 Lista opcional de códigos de descuento a aplicar
    } = await req.json();

    console.log('🔍 [POST /api/venta] Datos de la venta:', {
      usuarioId,
      total,
      totalcash,
      totaltransfer,
      syncId,
      productos,
      transferDestinationId,
      createdAt,
      wasOffline,
      syncAttempts,
      discountCodes
    });

    if (!tiendaId || !usuarioId || !cierreId || !productos.length || !syncId || !createdAt) {
      console.error('❌ [POST /api/venta] Datos insuficientes:', {
        tiendaId,
        usuarioId,
        cierreId,
        productosLength: productos.length,
        syncId,
        createdAt
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

    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId, fechaFin: null },
      orderBy: { fechaInicio: "desc" },
    });



    console.log('🔍 [POST /api/venta] Período actual:', ultimoPeriodo);

    if (!ultimoPeriodo) {
      return NextResponse.json({ error: "No existe un período abierto en la tienda" }, { status: 404 });
    }

    // 🆕 VALIDACIÓN: Verificar que la venta pertenece al período actual
    if (ultimoPeriodo.id !== cierreId) {
      // Buscar el período
      const periodoDeLaVenta = await prisma.cierrePeriodo.findUnique({
        where: {
          id: cierreId
        }
      });

      if(!periodoDeLaVenta) {
        return NextResponse.json({ error: "No existe un período con el id proporcionado" }, { status: 404 });
      }

      const ventaCreatedAt = new Date(createdAt);
      const periodoInicio = new Date(periodoDeLaVenta.fechaInicio);
      const periodoFin = periodoDeLaVenta.fechaFin && new Date(periodoDeLaVenta.fechaFin);
      return NextResponse.json({
        error: `La venta fue creada fuera del período actual. Venta: ${ventaCreatedAt.toLocaleString()}, Período: ${periodoInicio.toLocaleString()} - ${periodoFin.toLocaleString()}. No se puede sincronizar ventas de períodos anteriores.`,
        ventaCreatedAt: ventaCreatedAt.toISOString(),
        periodoInicio: periodoInicio.toISOString(),
        periodoFin: periodoFin ? periodoFin.toISOString() : undefined
      }, { status: 400 });
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
          proveedorId: true,
          producto: {
            select: {
              permiteDecimal: true
            }
          }
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

      // Validar cantidades decimales según configuración del producto
      const invalidDecimalProducts = productosMegrados.filter(
        (p) => p && typeof p.cantidad === 'number' && !Number.isInteger(p.cantidad) && !(p.producto && p.producto.permiteDecimal)
      );
      if (invalidDecimalProducts.length > 0) {
        const ids = invalidDecimalProducts.map((p) => p.productoId || p.productoTiendaId).join(', ');
        throw new Error(`Cantidad decimal no permitida para los productos: ${ids}`);
      }

      // 2. Calcular descuentos SIEMPRE en base a los productos del payload (códigos opcionales)
      let discountTotalCalc = 0;
      let discountCalcResult: Awaited<ReturnType<typeof applyDiscountsForSale>> | null = null;
      try {
        // Construir la lista de productos para el motor de descuentos con datos confiables
        // Preferimos los valores de la DB (productosMegrados.precio) y hacemos fallback al payload (price | precio)
        const discountProducts = productosMegrados.map((p: any) => ({
          productoTiendaId: p.productoTiendaId,
          cantidad: Number(p.cantidad) || 0,
          precio: Number(p.precio ?? p.price) || 0,
        }));

        discountCalcResult = await applyDiscountsForSale({
          tiendaId,
          discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
          products: discountProducts
        });
        discountTotalCalc = discountCalcResult.discountTotal;
        console.log('🧮 [POST /api/venta] Descuento calculado:', discountCalcResult);
      } catch (e:any) {
        console.error('❌ [POST /api/venta] Error calculando descuentos:', e?.message || e);
        // En caso de error, continuar sin aplicar descuentos
        discountTotalCalc = 0;
        discountCalcResult = null;
      }

      // 3. Crear la venta
      const venta = await tx.venta.create({
        data: {
          tiendaId,
          usuarioId,
          // Ajustar total SIEMPRE basado en el cálculo del backend para evitar dobles descuentos
          // Si discountCalcResult está disponible, usar finalTotal; de lo contrario, usar el total enviado
          total: discountCalcResult ? Number(discountCalcResult.finalTotal) : Math.max(0, Number(total) || 0),
          totalcash,
          totaltransfer,
          cierrePeriodoId: ultimoPeriodo.id,
          syncId,
          // 🆕 NUEVOS CAMPOS
          frontendCreatedAt: createdAt ? new Date(createdAt) : null,
          wasOffline: wasOffline || false,
          syncAttempts: syncAttempts || 0, // 🆕 Usar syncAttempts enviado desde frontend
          discountTotal: discountTotalCalc || 0,
          productos: {
            create: productosMegrados.map((p) => ({
              productoTiendaId: p.productoTiendaId,
              cantidad: p.cantidad,
              costo: p.costo,
              precio: p.precio
            })),
          },
          ...((transferDestinationId && totaltransfer > 0) && { transferDestinationId: transferDestinationId }),
        },
        include: {
          productos: true
        }
      });

      console.log('🔍 [POST /api/venta] Venta creada:', venta.id);

      // 3.1 Persistir AppliedDiscount si corresponde
      try {
        if ((discountTotalCalc || 0) > 0) {
          const applied = discountCalcResult?.applied || [];
          for (const a of applied) {
            await tx.appliedDiscount.create({
              data: {
                ventaId: venta.id,
                discountRuleId: a.discountRuleId,
                amount: a.amount,
                productsAffected: a.productsAffected ?? null,
              }
            });
          }
        }
      } catch (e:any) {
        console.error('❌ [POST /api/venta] Error guardando AppliedDiscount:', e?.message || e);
      }

      // 3. Manejar productos fraccionables (si aplica) - PRIMERO
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

        // Usar existencias originales para el cálculo
        const productosFraccionablesNeedDesagregateData = productosFraccionablesData
          .filter((prodFracc) => {
            const prod = productos.find(p => p.productoTiendaId === prodFracc.id);
            if (prod) {
              if (prodFracc.producto.unidadesPorFraccion <= prod.cantidad) {
                throw new Error(`Vendes más unidades sueltas de las que lleva una caja en una misma venta`);
              }
              // Usar existencia original (antes de cualquier modificación)
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
          console.log('🔍 [POST /api/venta] Procesando DESAGREGACION_BAJA...');
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
              
              if(existenciaAnterior < item.cantidad){
                console.log('🔍 [POST /api/venta] No hay suficiente existencia para desagregar. Existencia:', existenciaAnterior, 'Cantidad a desagregar:', item.cantidad);
                throw new Error(`Existencia insuficiente, no hay suficiente existencia para desagregar. Existencia: ${existenciaAnterior}, Cantidad a desagregar: ${item.cantidad}`);
              }

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
                  referenciaId: venta.id,
                  motivo: `Desagregación para venta ${venta.id}`
                }
              });

              console.log(`🔍 [POST /api/venta] DESAGREGACION_BAJA creada para producto ${productoTiendaDesagregar.id}: -${item.cantidad}`);
            }
          }
        }

        if (itemsDesagregaciónAlta.length > 0) {
          console.log('🔍 [POST /api/venta] Procesando DESAGREGACION_ALTA...');
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
                  referenciaId: venta.id,
                  motivo: `Desagregación para venta ${venta.id}`
                }
              });

              console.log(`🔍 [POST /api/venta] DESAGREGACION_ALTA creada para producto ${productoTiendaAgregar.id}: +${item.cantidad}`);
            }
          }
        }
      }

      // 4. Crear movimientos de stock y actualizar existencias - ÚLTIMO
      console.log('🔍 [POST /api/venta] Procesando movimientos de VENTA...');
      for (const producto of productos) {
        const productoTienda = productosExistentes.find(p => p.id === producto.productoTiendaId);
        if (!productoTienda) continue;

        // Obtener la existencia actual (después de desagregaciones si las hubo)
        const productoTiendaActual = await tx.productoTienda.findUnique({
          where: { id: producto.productoTiendaId },
          select: { existencia: true }
        });

        const existenciaAnterior = productoTiendaActual.existencia;

        if(existenciaAnterior < producto.cantidad) {
          console.log(`[POST /api/venta] No hay suficiente existencia para realizar la venta de productoTiendaId: ${producto.productoTiendaId}, existenciaAnterior: ${existenciaAnterior}, 'Cantidad a vender:`, producto.cantidad);
          throw new Error(`Existencia insuficiente para realizar la venta de productoTiendaId: ${producto.productoTiendaId}. Existencia: ${existenciaAnterior}, Cantidad a vender: ${producto.cantidad}`);
          
        }

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
            ...(productoTienda.proveedorId && { proveedorId: productoTienda.proveedorId })
          }
        });

        console.log(`🔍 [POST /api/venta] Movimiento VENTA creado para producto ${producto.productoTiendaId}: -${producto.cantidad}`);
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
        },
        appliedDiscounts: {
          include: {
            discountRule: {
              select: { name: true }
            }
          }
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
      discountTotal: (venta as any).discountTotal ?? 0,
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
      appliedDiscounts: ((venta as any).appliedDiscounts || []).map((ad: any) => ({
        id: ad.id,
        discountRuleId: ad.discountRuleId,
        ventaId: ad.ventaId,
        amount: ad.amount,
        productsAffected: ad.productsAffected ?? undefined,
        createdAt: ad.createdAt,
        ruleName: ad.discountRule?.name
      })),
      syncId: venta.syncId
    }));

    return NextResponse.json(ventas);

  } catch (error) {
    console.log(error);
    return NextResponse.json({ error: "Error al obtener las ventas" }, { status: 500 });
  }
}

