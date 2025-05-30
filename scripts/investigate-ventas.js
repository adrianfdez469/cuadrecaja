const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function investigateVentas() {
  console.log('🔍 Investigando posibles causas del error en ventas...\n');

  try {
    // 1. Verificar productos eliminados con referencias en ventas
    console.log('1. Buscando productos eliminados con referencias en ventas:');
    const productosEliminados = await prisma.$queryRaw`
      SELECT p.id, p.nombre, vp.id as venta_producto_id, v."createdAt" as fecha_venta
      FROM "Producto" p
      JOIN "ProductoTienda" pt ON p.id = pt."productoId"
      JOIN "VentaProducto" vp ON pt.id = vp."productoTiendaId"
      JOIN "Venta" v ON vp."ventaId" = v.id
      WHERE p.id NOT IN (SELECT id FROM "Producto")
      ORDER BY v."createdAt" DESC
    `;
    console.log('Productos eliminados con ventas:', productosEliminados);
    console.log('\n---\n');

    // 2. Revisar ventas con errores de sincronización
    console.log('2. Buscando ventas con errores de sincronización:');
    const ventasConError = await prisma.$queryRaw`
      SELECT v.id, v."syncId", v."createdAt", vp."productoTiendaId", pt."productoId"
      FROM "Venta" v
      JOIN "VentaProducto" vp ON v.id = vp."ventaId"
      JOIN "ProductoTienda" pt ON vp."productoTiendaId" = pt.id
      WHERE v."syncId" IS NOT NULL
      ORDER BY v."createdAt" DESC
      LIMIT 10
    `;
    console.log('Últimas 10 ventas con syncId:', ventasConError);
    console.log('\n---\n');

    // 3. Verificar productos fraccionados
    console.log('3. Verificando productos fraccionados:');
    const productosFraccionados = await prisma.$queryRaw`
      SELECT 
        p.id, 
        p.nombre, 
        p."fraccionDeId",
        p."unidadesPorFraccion",
        pt.id as productoTiendaId,
        pt.existencia
      FROM "Producto" p
      JOIN "ProductoTienda" pt ON p.id = pt."productoId"
      WHERE p."fraccionDeId" IS NOT NULL
      ORDER BY p.nombre
    `;
    console.log('Productos fraccionados:', productosFraccionados);
    console.log('\n---\n');

    // 4. Verificar movimientos recientes
    console.log('4. Últimos movimientos de stock:');
    const movimientosRecientes = await prisma.movimientoStock.findMany({
      take: 10,
      orderBy: {
        fecha: 'desc'
      },
      include: {
        productoTienda: {
          include: {
            producto: true
          }
        }
      }
    });
    console.log('Últimos 10 movimientos:', JSON.stringify(movimientosRecientes, null, 2));

  } catch (error) {
    console.error('Error durante la investigación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

investigateVentas(); 