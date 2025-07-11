#!/usr/bin/env node

/**
 * Script para migrar datos históricos de CPP en producción
 * 
 * Uso:
 * node scripts/migrate-cpp-production.js --tienda=TIENDA_ID [--dry-run] [--verbose]
 * 
 * Ejemplos:
 * node scripts/migrate-cpp-production.js --tienda=clxyz123 --dry-run
 * node scripts/migrate-cpp-production.js --tienda=clxyz123 --verbose
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Configuración de argumentos
const args = process.argv.slice(2);
const config = {
  tiendaId: null,
  dryRun: false,
  verbose: false
};

// Parsear argumentos
args.forEach(arg => {
  if (arg.startsWith('--tienda=')) {
    config.tiendaId = arg.split('=')[1];
  } else if (arg === '--dry-run') {
    config.dryRun = true;
  } else if (arg === '--verbose') {
    config.verbose = true;
  }
});

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '📋',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🔍'
  }[level] || '📋';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function debugLog(message) {
  if (config.verbose) {
    log(message, 'debug');
  }
}

async function migrarDatosHistoricosCPP() {
  try {
    log('🚀 INICIANDO MIGRACIÓN DE DATOS HISTÓRICOS CPP');
    log(`Tienda ID: ${config.tiendaId}`);
    log(`Modo: ${config.dryRun ? 'SIMULACIÓN' : 'PRODUCCIÓN'}`);
    log(`Verbose: ${config.verbose ? 'SÍ' : 'NO'}`);
    
    if (!config.tiendaId) {
      throw new Error('Debe especificar --tienda=TIENDA_ID');
    }

    // Verificar que la tienda existe
    const tienda = await prisma.tienda.findUnique({
      where: { id: config.tiendaId },
      select: { nombre: true }
    });

    if (!tienda) {
      throw new Error(`Tienda con ID ${config.tiendaId} no encontrada`);
    }

    log(`Tienda encontrada: ${tienda.nombre}`);

    // Buscar movimientos sin datos CPP
    const movimientosSinCPP = await prisma.movimientoStock.findMany({
      where: {
        tiendaId: config.tiendaId,
        tipo: 'COMPRA',
        costoUnitario: null
      },
      include: {
        productoTienda: {
          include: {
            producto: {
              select: {
                nombre: true
              }
            }
          }
        }
      },
      orderBy: {
        fecha: 'asc'
      }
    });

    log(`Movimientos encontrados sin CPP: ${movimientosSinCPP.length}`);

    if (movimientosSinCPP.length === 0) {
      log('No hay movimientos para migrar', 'success');
      return;
    }

    // Mostrar resumen
    const productosAfectados = new Set(movimientosSinCPP.map(m => m.productoTienda.producto.nombre));
    log(`Productos afectados: ${productosAfectados.size}`);
    
    if (config.verbose) {
      log('Lista de productos afectados:');
      productosAfectados.forEach(nombre => {
        const count = movimientosSinCPP.filter(m => m.productoTienda.producto.nombre === nombre).length;
        debugLog(`  - ${nombre}: ${count} movimientos`);
      });
    }

    if (config.dryRun) {
      log('🔍 SIMULACIÓN - No se realizarán cambios');
      
      movimientosSinCPP.forEach((mov, index) => {
        debugLog(`${index + 1}. ${mov.productoTienda.producto.nombre} (${mov.fecha.toLocaleDateString()}) - ${mov.cantidad} unidades`);
      });
      
      log(`Total a procesar: ${movimientosSinCPP.length} movimientos`, 'info');
      return;
    }

    // Procesar movimientos
    let procesados = 0;
    let errores = 0;

    log('🔄 Iniciando procesamiento...');

    for (const [index, movimiento] of movimientosSinCPP.entries()) {
      try {
        const costoActual = movimiento.productoTienda.costo || 0;
        
        await prisma.movimientoStock.update({
          where: {
            id: movimiento.id
          },
          data: {
            costoUnitario: 0, // Marcador de dato histórico
            costoTotal: 0,
            costoAnterior: costoActual,
            costoNuevo: costoActual
          }
        });

        procesados++;
        
        if (config.verbose) {
          debugLog(`${index + 1}/${movimientosSinCPP.length}: ${movimiento.productoTienda.producto.nombre} - Procesado`);
        } else if ((index + 1) % 10 === 0) {
          log(`Progreso: ${index + 1}/${movimientosSinCPP.length} (${((index + 1) / movimientosSinCPP.length * 100).toFixed(1)}%)`);
        }

      } catch (error) {
        errores++;
        log(`Error procesando ${movimiento.productoTienda.producto.nombre}: ${error.message}`, 'error');
      }
    }

    // Resumen final
    log('📊 RESUMEN DE MIGRACIÓN:');
    log(`✅ Movimientos procesados: ${procesados}`);
    log(`❌ Errores: ${errores}`);
    log(`📈 Tasa de éxito: ${((procesados / movimientosSinCPP.length) * 100).toFixed(1)}%`);

    if (procesados > 0) {
      log('🎉 Migración completada exitosamente', 'success');
    } else {
      log('⚠️ No se procesaron movimientos', 'warning');
    }

  } catch (error) {
    log(`Error en migración: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Mostrar ayuda
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
📋 Script de Migración CPP para Producción

Uso:
  node scripts/migrate-cpp-production.js --tienda=TIENDA_ID [opciones]

Opciones:
  --tienda=ID     ID de la tienda a migrar (requerido)
  --dry-run       Solo simular, no hacer cambios
  --verbose       Mostrar información detallada
  --help, -h      Mostrar esta ayuda

Ejemplos:
  # Simular migración
  node scripts/migrate-cpp-production.js --tienda=clxyz123 --dry-run

  # Ejecutar migración con detalles
  node scripts/migrate-cpp-production.js --tienda=clxyz123 --verbose

  # Ejecutar migración silenciosa
  node scripts/migrate-cpp-production.js --tienda=clxyz123

⚠️  IMPORTANTE: 
- Siempre ejecutar primero con --dry-run para verificar
- Hacer backup de la base de datos antes de ejecutar
- Este script marca movimientos históricos con costoUnitario = 0
  `);
  process.exit(0);
}

// Ejecutar migración
migrarDatosHistoricosCPP(); 