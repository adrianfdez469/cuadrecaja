import { prisma } from '@/lib/prisma';
import { getSessionFromRequest } from '@/utils/authFromRequest';
import { NextRequest, NextResponse } from 'next/server';
import { cambiarMonedaBaseSchema } from '@/schemas/tasaCambio';
import { buildTasaSnapshot, convertToBase, convertFromBase } from '@/lib/currency';

/** GET — preview de cuántos precios/costos se convertirán y a qué valores */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const monedaNueva = searchParams.get('monedaNueva');
    if (!monedaNueva) return NextResponse.json({ error: 'Falta monedaNueva' }, { status: 400 });

    const negocio = await prisma.negocio.findUnique({ where: { id }, select: { monedaBase: true } });
    if (!negocio) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    if (negocio.monedaBase === monedaNueva) {
      return NextResponse.json({ error: 'La moneda nueva es igual a la actual' }, { status: 400 });
    }

    const tasasCambio = await prisma.tasaCambio.findMany({ where: { negocioId: id } });
    const tasas = buildTasaSnapshot(tasasCambio);

    if (!tasas[monedaNueva] && monedaNueva !== 'CUP') {
      return NextResponse.json({ error: `No hay tasa registrada para ${monedaNueva}` }, { status: 400 });
    }

    // Muestra 5 productos de ejemplo con precios antes/después
    const ejemplos = await prisma.productoTienda.findMany({
      where: { tienda: { negocioId: id } },
      select: { id: true, precio: true, costo: true, producto: { select: { nombre: true } } },
      take: 5,
    });

    const totalProductos = await prisma.productoTienda.count({ where: { tienda: { negocioId: id } } });
    const totalGastosFijos = await prisma.gastoTienda.count({
      where: { negocioId: id, tipoCalculo: 'MONTO_FIJO', monto: { not: null } },
    });

    const preview = ejemplos.map((p) => ({
      nombre: p.producto.nombre,
      precioAntes: p.precio,
      precioDepues: convertFromBase(convertToBase(p.precio, negocio.monedaBase, tasas), monedaNueva, tasas),
      costoAntes: p.costo,
      costoDepues: convertFromBase(convertToBase(p.costo, negocio.monedaBase, tasas), monedaNueva, tasas),
    }));

    return NextResponse.json({
      monedaActual: negocio.monedaBase,
      monedaNueva,
      tasa: monedaNueva === 'CUP' ? 1 : tasas[monedaNueva],
      totalProductos,
      totalGastosFijos,
      preview,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al generar preview' }, { status: 500 });
  }
}

/** POST — ejecuta el cambio de moneda base convirtiendo todos los precios/costos */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const result = cambiarMonedaBaseSchema.safeParse(body);
    if (!result.success) return NextResponse.json({ error: result.error.flatten() }, { status: 400 });

    const negocio = await prisma.negocio.findUnique({ where: { id }, select: { monedaBase: true } });
    if (!negocio) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });

    const { monedaNueva } = result.data;
    if (negocio.monedaBase === monedaNueva) {
      return NextResponse.json({ error: 'La moneda nueva es igual a la actual' }, { status: 400 });
    }

    const tasasCambio = await prisma.tasaCambio.findMany({ where: { negocioId: id } });
    const tasas = buildTasaSnapshot(tasasCambio);
    // With CUP anchor: tasas always express 1 X = Y CUP. CUP itself is always 1.
    const tasaUsada = monedaNueva === 'CUP' ? 1 : tasas[monedaNueva];
    if (monedaNueva !== 'CUP' && !tasaUsada) {
      return NextResponse.json({ error: `No hay tasa registrada para ${monedaNueva}` }, { status: 400 });
    }

    // Transacción: convierte precios/costos y actualiza Negocio
    await prisma.$transaction(async (tx) => {
      const productos = await tx.productoTienda.findMany({
        where: { tienda: { negocioId: id } },
        select: { id: true, precio: true, costo: true },
      });

      // Route through CUP: monedaAntigua → CUP → monedaNueva
      for (const p of productos) {
        const precioNuevo = convertFromBase(
          convertToBase(p.precio, negocio.monedaBase, tasas),
          monedaNueva,
          tasas,
        );
        const costoNuevo = convertFromBase(
          convertToBase(p.costo, negocio.monedaBase, tasas),
          monedaNueva,
          tasas,
        );
        await tx.productoTienda.update({
          where: { id: p.id },
          data: {
            precio: Math.round(precioNuevo * 100) / 100,
            costo: Math.round(costoNuevo * 100) / 100,
          },
        });
      }

      // Convert fixed-amount expenses (MONTO_FIJO) — percentage-based ones are unaffected
      const gastosFijos = await tx.gastoTienda.findMany({
        where: { negocioId: id, tipoCalculo: 'MONTO_FIJO', monto: { not: null } },
        select: { id: true, monto: true },
      });
      for (const g of gastosFijos) {
        const montoNuevo = convertFromBase(
          convertToBase(g.monto!, negocio.monedaBase, tasas),
          monedaNueva,
          tasas,
        );
        await tx.gastoTienda.update({
          where: { id: g.id },
          data: { monto: Math.round(montoNuevo * 100) / 100 },
        });
      }

      await tx.historialMonedaBase.create({
        data: {
          negocioId: id,
          monedaAnterior: negocio.monedaBase,
          monedaNueva,
          tasaUsada: tasaUsada ?? 1,
          creadoPorId: session.user.id,
        },
      });

      // CUP-anchor: rates never need rescaling on base change — they stay CUP-relative always
      await tx.negocio.update({ where: { id }, data: { monedaBase: monedaNueva } });
    });

    return NextResponse.json({ ok: true, monedaBase: monedaNueva });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al cambiar moneda base' }, { status: 500 });
  }
}
