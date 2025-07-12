#!/usr/bin/env node

/**
 * Script para debug de APIs específicas
 * Uso: node scripts/debug-api.js [api-name]
 */

const { PrismaClient } = require('@prisma/client');

// Configurar Prisma con logging
const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'info',
    },
  ],
});

// Log de queries
prisma.$on('query', (e) => {
  console.log('🗄️ Query:', e.query);
  console.log('⏱️ Duración:', e.duration + 'ms');
  console.log('📋 Params:', e.params);
  console.log('---');
});

async function debugCPPAPI() {
  console.log('🔍 Debugging CPP API...');
  
  try {
    // Simular análisis CPP
    const productos = await prisma.productoTienda.findMany({
      where: {
        existencia: { gt: 0 }
      },
      include: {
        producto: {
          select: { nombre: true }
        }
      },
      take: 5
    });
    
    console.log('📦 Productos encontrados:', productos.length);
    
    for (const producto of productos) {
      console.log(`\n🔍 Analizando: ${producto.producto.nombre}`);
      
      const movimientos = await prisma.movimientoStock.findMany({
        where: {
          productoTiendaId: producto.id,
          tipo: 'COMPRA'
        },
        orderBy: { fecha: 'asc' }
      });
      
      console.log(`   📊 Movimientos: ${movimientos.length}`);
      
      const conCPP = movimientos.filter(m => m.costoUnitario !== null).length;
      const sinCPP = movimientos.filter(m => m.costoUnitario === null).length;
      
      console.log(`   ✅ Con CPP: ${conCPP}`);
      console.log(`   ❌ Sin CPP: ${sinCPP}`);
      
      if (movimientos.length > 0) {
        const ultimo = movimientos[movimientos.length - 1];
        console.log(`   🕒 Última compra: ${ultimo.fecha.toLocaleDateString()}`);
        console.log(`   💰 Costo actual: $${producto.costo}`);
        console.log(`   📦 Existencia: ${producto.existencia}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function debugMigrationAPI() {
  console.log('🔄 Debugging Migration API...');
  
  try {
    // Buscar movimientos sin CPP
    const movimientosSinCPP = await prisma.movimientoStock.findMany({
      where: {
        tipo: 'COMPRA',
        costoUnitario: null
      },
      include: {
        productoTienda: {
          include: {
            producto: {
              select: { nombre: true }
            }
          }
        }
      },
      take: 10
    });
    
    console.log(`📋 Movimientos sin CPP encontrados: ${movimientosSinCPP.length}`);
    
    movimientosSinCPP.forEach((mov, index) => {
      console.log(`\n${index + 1}. ${mov.productoTienda.producto.nombre}`);
      console.log(`   📅 Fecha: ${mov.fecha.toLocaleDateString()}`);
      console.log(`   📦 Cantidad: ${mov.cantidad}`);
      console.log(`   💰 Costo actual del producto: $${mov.productoTienda.costo}`);
    });
    
  } catch (error) {
    console.error('❌ Error en debug:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Función principal
async function main() {
  const apiName = process.argv[2];
  
  console.log('🚀 Iniciando debug de API...');
  console.log(`🎯 API objetivo: ${apiName || 'todas'}`);
  
  switch (apiName) {
    case 'cpp':
      await debugCPPAPI();
      break;
    case 'migration':
      await debugMigrationAPI();
      break;
    default:
      console.log('📋 APIs disponibles:');
      console.log('   cpp - Debug CPP API');
      console.log('   migration - Debug Migration API');
      console.log('\nUso: node scripts/debug-api.js [api-name]');
  }
}

main().catch(console.error); 