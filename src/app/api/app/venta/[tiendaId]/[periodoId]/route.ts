import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { applyDiscountsForSale } from '@/lib/discounts';
import { IVenta } from '@/types/IVenta';

// Tipos auxiliares
interface IncomingProduct {
  productoTiendaId: string;
  cantidad: number;
  name?: string;
  price?: number;
  precio?: number;
  productId?: string;
}

interface ProductoExistenteSelect {
  id: string;
  productoId: string;
  existencia: number;
  costo: number;
  precio: number;
  proveedorId: string | null;
  producto: { permiteDecimal: boolean };
}

type MergedProduct = ProductoExistenteSelect & IncomingProduct;

/**
 * POST /api/app/venta/[tiendaId]/[periodoId]
 * 
 * Crea una nueva venta. Soporta sincronización offline con syncId.
 * Requiere autenticación por token.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; periodoId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tiendaId, periodoId } = await params;

    const {
      productos,
      total,
      totalcash,
      totaltransfer,
      transferDestinationId,
      syncId,
      createdAt,
      wasOffline,
      syncAttempts,
      discountCodes
    } = await request.json();

    const usuarioId = session.user.id;

    // Validaciones básicas: detectar qué datos faltan
    const faltantes: string[] = [];
    if (!tiendaId) faltantes.push('tiendaId');
    if (!periodoId) faltantes.push('periodoId');
    if (!productos?.length) faltantes.push('productos (o lista vacía)');
    if (!syncId) faltantes.push('syncId');
    if (createdAt == null || createdAt === '') faltantes.push('createdAt');

    if (faltantes.length > 0) {
      return NextResponse.json(
        {
          error: `Datos insuficientes para crear la venta: ${faltantes.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Verificar idempotencia - si ya existe una venta con este syncId
    const existeVenta = await prisma.venta.findFirst({
      where: { syncId },
      include: { productos: true }
    });

    if (existeVenta) {
      return NextResponse.json({
        success: true,
        venta: existeVenta,
        duplicado: true
      });
    }

    // Verificar que el período está abierto
    const ultimoPeriodo = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId, fechaFin: null },
      orderBy: { fechaInicio: 'desc' },
    });

    if (!ultimoPeriodo) {
      return NextResponse.json(
        { error: 'No existe un período abierto en la tienda' },
        { status: 400 }
      );
    }

    // Validar que la venta pertenece al período actual
    if (ultimoPeriodo.id !== periodoId) {
      const periodoDeLaVenta = await prisma.cierrePeriodo.findUnique({
        where: { id: periodoId }
      });

      if (!periodoDeLaVenta) {
        return NextResponse.json(
          { error: `No existe un período con el id proporcionado. El ultimo periodo abierto es: ${ultimoPeriodo.fechaInicio.toLocaleString()}` },
          { status: 404 }
        );
      }

      return NextResponse.json({
        error: `La venta pertenece a un período cerrado o diferente al actual. El ultimo periodo abierto es: ${ultimoPeriodo.fechaInicio.toLocaleString()}`,
        periodoActualId: ultimoPeriodo.id
      }, { status: 400 });
    }

    // Transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verificar que todos los productos existen
      const productosExistentes = await tx.productoTienda.findMany({
        where: {
          id: { in: productos.map((p: IncomingProduct) => p.productoTiendaId) }
        },
        select: {
          id: true,
          productoId: true,
          existencia: true,
          costo: true,
          precio: true,
          proveedorId: true,
          producto: {
            select: { permiteDecimal: true }
          }
        }
      });

      const productosNoEncontrados = productos.filter(
        (p: IncomingProduct) => !productosExistentes.some(pe => pe.id === p.productoTiendaId)
      );

      if (productosNoEncontrados.length > 0) {
        throw new Error(`Productos no encontrados: ${productosNoEncontrados.map((p: IncomingProduct) => p.name || p.productoTiendaId).join(', ')}`);
      }

      const productosMergeados = productosExistentes.map((p) => {
        const producto = productos.find((p2: IncomingProduct) => p2.productoTiendaId === p.id);
        return { ...p, ...producto };
      }) as MergedProduct[];

      // Validar cantidades decimales
      const invalidDecimalProducts = productosMergeados.filter(
        (p) => !Number.isInteger(p.cantidad) && !p.producto.permiteDecimal
      );
      if (invalidDecimalProducts.length > 0) {
        throw new Error(`Cantidad decimal no permitida para algunos productos`);
      }

      // 2. Calcular descuentos
      let discountTotalCalc = 0;
      let discountCalcResult: Awaited<ReturnType<typeof applyDiscountsForSale>> | null = null;

      try {
        const discountProducts = productosMergeados.map((p) => ({
          productoTiendaId: String(p.productoTiendaId),
          cantidad: Number(p.cantidad) || 0,
          precio: Number(p.precio ?? p.price) || 0,
        }));

        discountCalcResult = await applyDiscountsForSale({
          tiendaId,
          discountCodes: Array.isArray(discountCodes) ? discountCodes : [],
          products: discountProducts
        });
        discountTotalCalc = discountCalcResult.discountTotal;
      } catch {
        discountTotalCalc = 0;
        discountCalcResult = null;
      }

      // 3. Crear la venta
      const venta = await tx.venta.create({
        data: {
          tiendaId,
          usuarioId,
          total: discountCalcResult ? Number(discountCalcResult.finalTotal) : Math.max(0, Number(total) || 0),
          totalcash: totalcash || 0,
          totaltransfer: totaltransfer || 0,
          cierrePeriodoId: ultimoPeriodo.id,
          syncId,
          frontendCreatedAt: createdAt ? new Date(createdAt) : null,
          wasOffline: wasOffline || false,
          syncAttempts: syncAttempts || 0,
          discountTotal: discountTotalCalc || 0,
          productos: {
            create: productosMergeados.map((p) => ({
              productoTiendaId: p.productoTiendaId,
              cantidad: p.cantidad,
              costo: p.costo,
              precio: p.precio
            })),
          },
          ...((transferDestinationId && totaltransfer > 0) && { transferDestinationId }),
        },
        include: { productos: true }
      });

      // 3.1 Guardar descuentos aplicados
      if ((discountTotalCalc || 0) > 0 && discountCalcResult?.applied) {
        for (const a of discountCalcResult.applied) {
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

      // 4. Manejar productos fraccionables
      const productosFraccionables = await tx.productoTienda.findMany({
        where: {
          id: { in: productos.map((p: IncomingProduct) => p.productoTiendaId) },
          producto: { fraccionDeId: { not: null } }
        },
        include: {
          producto: {
            select: { fraccionDeId: true, unidadesPorFraccion: true, nombre: true }
          }
        }
      });

      if (productosFraccionables.length > 0) {
        const productosFraccionablesData = productosFraccionables.filter(pf => pf.producto.fraccionDeId);

        const productosFraccionablesNeedDesagregateData = productosFraccionablesData
          .filter((prodFracc) => {
            const prod = productos.find((p: IncomingProduct) => p.productoTiendaId === prodFracc.id);
            if (prod) {
              if (prodFracc.producto.unidadesPorFraccion && prodFracc.producto.unidadesPorFraccion <= prod.cantidad) {
                throw new Error(`Vendes más unidades sueltas de las que lleva una caja en una misma venta. Producto: ${prodFracc.producto.nombre}, Cantidad: ${prod.cantidad}, Unidades por fracción: ${prodFracc.producto.unidadesPorFraccion}`);
              }
              return prodFracc.existencia < prod.cantidad;
            }
            return false;
          });

        const itemsDesagregacionBaja: Array<{ cantidad: number; productoId: string | null }> = [];
        const itemsDesagregacionAlta: Array<{ cantidad: number; productoId: string }> = [];

        productosFraccionablesNeedDesagregateData.forEach((item) => {
          if (item.producto.unidadesPorFraccion) {
            itemsDesagregacionAlta.push({
              cantidad: item.producto.unidadesPorFraccion,
              productoId: item.productoId
            });
          }
          itemsDesagregacionBaja.push({
            cantidad: 1,
            productoId: item.producto.fraccionDeId
          });
        });

        // Procesar DESAGREGACION_BAJA
        for (const item of itemsDesagregacionBaja) {
          if (!item.productoId) continue;
          
          const productoTiendaDesagregar = await tx.productoTienda.findFirst({
            where: { tiendaId, productoId: item.productoId, proveedorId: null },
            include: { producto: { select: { nombre: true } } }
          });

          if (productoTiendaDesagregar) {
            const existenciaAnterior = productoTiendaDesagregar.existencia;

            if (existenciaAnterior < item.cantidad) {
              throw new Error(`Existencia insuficiente para desagregar. Producto: ${productoTiendaDesagregar.producto.nombre}, Cantidad: ${item.cantidad}, Existencia anterior: ${existenciaAnterior}`);
            }

            await tx.productoTienda.update({
              where: { id: productoTiendaDesagregar.id },
              data: { existencia: { decrement: item.cantidad } }
            });

            await tx.movimientoStock.create({
              data: {
                tipo: 'DESAGREGACION_BAJA',
                cantidad: item.cantidad,
                productoTiendaId: productoTiendaDesagregar.id,
                tiendaId,
                usuarioId,
                existenciaAnterior,
                referenciaId: venta.id,
                motivo: `Desagregación para venta ${venta.id}`
              }
            });
          }
        }

        // Procesar DESAGREGACION_ALTA
        for (const item of itemsDesagregacionAlta) {
          const productoTiendaAgregar = await tx.productoTienda.findFirst({
            where: { tiendaId, productoId: item.productoId, proveedorId: null }
          });

          if (productoTiendaAgregar) {
            const existenciaAnterior = productoTiendaAgregar.existencia;

            await tx.productoTienda.update({
              where: { id: productoTiendaAgregar.id },
              data: { existencia: { increment: item.cantidad } }
            });

            await tx.movimientoStock.create({
              data: {
                tipo: 'DESAGREGACION_ALTA',
                cantidad: item.cantidad,
                productoTiendaId: productoTiendaAgregar.id,
                tiendaId,
                usuarioId,
                existenciaAnterior,
                referenciaId: venta.id,
                motivo: `Desagregación para venta ${venta.id}`
              }
            });
          }
        }
      }

      // 5. Crear movimientos de venta y actualizar existencias
      for (const producto of productos as IncomingProduct[]) {
        const productoTienda = productosExistentes.find(p => p.id === producto.productoTiendaId);
        if (!productoTienda) continue;

        const productoTiendaActual = await tx.productoTienda.findUnique({
          where: { id: producto.productoTiendaId },
          select: { existencia: true }
        });

        if (!productoTiendaActual) continue;

        const existenciaAnterior = productoTiendaActual.existencia;

        if (existenciaAnterior < producto.cantidad) {
          throw new Error(`Existencia insuficiente para ${producto.name || producto.productoTiendaId}`);
        }

        await tx.productoTienda.update({
          where: { id: producto.productoTiendaId },
          data: { existencia: { decrement: producto.cantidad } }
        });

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
      }

      return venta;
    });

    return NextResponse.json({
      success: true,
      venta: result,
      duplicado: false
    }, { status: 201 });

  } catch (error) {
    console.error('❌ [APP/VENTA/POST] Error:', error);
    const message = error instanceof Error ? error.message : 'Error al crear la venta';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/app/venta/[tiendaId]/[periodoId]
 * 
 * Obtiene las ventas de un período específico.
 * Requiere autenticación por token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; periodoId: string }> }
) {
  try {
    const session = await getSessionFromRequest(request);

    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    const { tiendaId, periodoId } = await params;

    if (!tiendaId || !periodoId) {
      return NextResponse.json(
        { error: 'tiendaId y periodoId son requeridos' },
        { status: 400 }
      );
    }

    const ventasPrisma = await prisma.venta.findMany({
      include: {
        usuario: {
          select: { id: true, nombre: true }
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
                  select: { id: true, nombre: true }
                },
                producto: {
                  select: { nombre: true, id: true }
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
        },
        transferDestination: {
          select: { id: true, nombre: true }
        }
      },
      where: {
        cierrePeriodoId: periodoId,
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
      discountTotal: Number(venta.discountTotal ?? 0),
      tiendaId: venta.tiendaId,
      usuarioId: venta.usuarioId,
      cierrePeriodoId: venta.cierrePeriodoId,
      usuario: {
        id: venta.usuario.id,
        nombre: venta.usuario.nombre,
        usuario: '',
        rol: ''
      },
      productos: venta.productos.map((p) => ({
        id: p.producto.producto.id,
        ventaId: venta.id,
        productoTiendaId: p.productoTiendaId,
        cantidad: p.cantidad,
        name: p.producto.proveedor 
          ? `${p.producto?.producto?.nombre} - ${p.producto.proveedor.nombre}` 
          : p.producto?.producto?.nombre ?? undefined,
        price: p.precio ?? undefined
      })),
      appliedDiscounts: (venta.appliedDiscounts || []).map((ad) => ({
        id: ad.id,
        discountRuleId: ad.discountRuleId,
        ventaId: ad.ventaId,
        amount: ad.amount,
        productsAffected: ad.productsAffected as unknown as { productoTiendaId: string; cantidad: number }[] | undefined,
        createdAt: ad.createdAt,
        ruleName: ad.discountRule?.name
      })),
      syncId: venta.syncId,
      transferDestinationId: venta.transferDestinationId ?? undefined,
      transferDestination: venta.transferDestination ?? undefined
    }));

    return NextResponse.json({
      success: true,
      ventas: ventas,
      total: ventas.length
    });

  } catch (error) {
    console.error('❌ [APP/VENTA/GET] Error:', error);
    return NextResponse.json(
      { error: 'Error al obtener las ventas' },
      { status: 500 }
    );
  }
}
