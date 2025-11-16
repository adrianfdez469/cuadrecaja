import { PrismaClient } from "@prisma/client";
import * as path from "path";
import * as fs from "fs";
import * as process from "process";
import dotenv from "dotenv";

// Cargar .env desde el raíz del proyecto
const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = { dryRun: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args["help"] = true;
    else if (a === "--dry-run") args["dryRun"] = true;
    else if (a === "--execute") args["dryRun"] = false;
    else if (a === "--yes" || a === "-y") args["yes"] = true;
    else if (a === "--negocioId") args["negocioId"] = argv[++i];
    else if (a === "--nombre") args["nombre"] = argv[++i];
    else {
      console.warn(`Argumento ignorado: ${a}`);
    }
  }
  return args as {
    help?: boolean;
    dryRun: boolean;
    yes?: boolean;
    negocioId?: string;
    nombre?: string;
  };
}

function printHelp() {
  console.log(`Uso:
  node dist/limpiarNegocio.js --negocioId <uuid> [--execute] [--yes]
  node dist/limpiarNegocio.js --nombre "Nombre Negocio" [--execute] [--yes]

Opciones:
  --dry-run   Modo simulación (por defecto)
  --execute   Ejecuta realmente los borrados
  --yes, -y   Omite confirmación
  --help, -h  Muestra esta ayuda
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let negocio = null as null | { id: string; nombre: string };
  if (args.negocioId) {
    negocio = await prisma.negocio.findUnique({ where: { id: String(args.negocioId) }, select: { id: true, nombre: true } });
  } else if (args.nombre) {
    negocio = await prisma.negocio.findUnique({ where: { nombre: String(args.nombre) }, select: { id: true, nombre: true } });
  } else {
    console.error("Debes proporcionar --negocioId o --nombre");
    printHelp();
    process.exit(1);
  }

  if (!negocio) {
    console.error("Negocio no encontrado");
    process.exit(1);
  }

  const negocioId = negocio.id;
  console.log(`Negocio seleccionado: ${negocio.nombre} (${negocio.id})`);

  // Recolectamos IDs relacionados
  const tiendas = await prisma.tienda.findMany({
    where: { negocioId },
    select: { id: true },
  });

  const usuarios = await prisma.usuario.findMany({
    where: { negocioId },
    select: { id: true },
  });

  const categorias = await prisma.categoria.findMany({
    where: { negocioId },
    select: { id: true },
  });

  const productos = await prisma.producto.findMany({
    where: { negocioId },
    select: { id: true },
  });

  const proveedores = await prisma.proveedor.findMany({
    where: { negocioId },
    select: { id: true },
  });

  const roles = await prisma.rol.findMany({
    where: { negocioId },
    select: { id: true },
  });


  const tiendaIds = tiendas.map(t => t.id);
  const usuarioIds = usuarios.map(u => u.id);
  const productoIds = productos.map(p => p.id);

  const productoTiendas = await prisma.productoTienda.findMany({ where: { tiendaId: { in: tiendaIds } }, select: { id: true } });
  const ventas =  await prisma.venta.findMany({ where: { tiendaId: { in: tiendaIds } }, select: { id: true } });
  const cierres = await  prisma.cierrePeriodo.findMany({ where: { tiendaId: { in: tiendaIds } }, select: { id: true } });

  const productoTiendaIds = productoTiendas.map(pt => pt.id);
  const ventaIds = ventas.map(v => v.id);
  const cierreIds = cierres.map(c => c.id);

  // Conteos
  const counts = {
    tiendas: tiendaIds.length,
    usuarios: usuarioIds.length,
    categorias: categorias.length,
    productos: productoIds.length,
    proveedores: proveedores.length,
    roles: roles.length,
    productoTiendas: productoTiendaIds.length,
    ventas: ventaIds.length,
    cierres: cierreIds.length,
  };

  // Conteos de tablas hija directas
  const ventaProductoCount = await prisma.ventaProducto.count({
    where: {
      ventaId: { in: ventaIds },
    },
  });

  const movimientoCount = await prisma.movimientoStock.count({
    where: {
      OR: [
        { productoTiendaId: { in: productoTiendaIds } },
        { tiendaId: { in: tiendaIds } },
        { destinationId: { in: tiendaIds } },
      ],
    },
  });

  const transferDestCount = await prisma.transferDestinations.count({
    where: {
      tiendaId: { in: tiendaIds },
    },
  });

  const usuarioTiendaCount = await prisma.usuarioTienda.count({
    where: {
      OR: [
        { tiendaId: { in: tiendaIds } },
        { usuarioId: { in: usuarioIds } },
      ],
    },
  });

  const codigoProductoCount = await prisma.codigoProducto.count({
    where: {
      productoId: { in: productoIds },
    },
  });

  const pplCount = await prisma.productoProveedorLiquidacion.count({
    where: {
      cierreId: { in: cierreIds },
    },
  });


  console.log("Resumen (modo", args.dryRun ? "simulación" : "ejecución", "):");
  console.table({
    Tiendas: counts.tiendas,
    Usuarios: counts.usuarios,
    Categorias: counts.categorias,
    Productos: counts.productos,
    Proveedores: counts.proveedores,
    Roles: counts.roles,
    ProductoTiendas: counts.productoTiendas,
    Ventas: counts.ventas,
    Cierres: counts.cierres,
    VentaProductos: ventaProductoCount,
    MovimientosStock: movimientoCount,
    TransferDestinations: transferDestCount,
    UsuarioTienda: usuarioTiendaCount,
    CodigoProducto: codigoProductoCount,
    ProdProvLiquidacion: pplCount,
  });

  if (args.dryRun) {
    console.log("Modo simulación: no se borró nada.");
    await prisma.$disconnect();
    return;
  }

  if (!args.yes) {
    console.error("Falta confirmación --yes. Abortando para evitar pérdidas de datos.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Orden de borrado seguro (secuencial para respetar FKs)
  // 1) Tablas puramente hijas
  // Eliminar productos de ventas para TODAS las ventas del negocio (por tienda o por usuario)
  await prisma.ventaProducto.deleteMany({
    where: {
      OR: [
        { venta: { tiendaId: { in: tiendaIds } } },
        { venta: { usuarioId: { in: usuarioIds } } }
      ]
    }
  });
  await prisma.productoProveedorLiquidacion.deleteMany({ where: { cierreId: { in: cierreIds } } });
  await prisma.movimientoStock.deleteMany({ where: { OR: [
    { productoTiendaId: { in: productoTiendaIds } },
    { tiendaId: { in: tiendaIds } },
    { destinationId: { in: tiendaIds } },
  ] } });
  await prisma.usuarioTienda.deleteMany({ where: { OR: [ { tiendaId: { in: tiendaIds } }, { usuarioId: { in: usuarioIds } } ] } });
  await prisma.codigoProducto.deleteMany({ where: { productoId: { in: productoIds } } });

  // 2) Tablas intermedias y de nivel medio
  // Borrar VENTAS del negocio (ya no hay VentaProducto)
  await prisma.venta.deleteMany({
    where: {
      OR: [
        { tiendaId: { in: tiendaIds } },
        { usuarioId: { in: usuarioIds } }
      ]
    }
  });
  // Cierres y productos por tienda
  await prisma.cierrePeriodo.deleteMany({ where: { tiendaId: { in: tiendaIds } } });
  await prisma.productoTienda.deleteMany({ where: { tiendaId: { in: tiendaIds } } });
  // Ahora es seguro eliminar destinos de transferencia asociados a la tienda
  await prisma.transferDestinations.deleteMany({ where: { tiendaId: { in: tiendaIds } } });

  // 3) Preparación: limpiar referencias de Usuario a Tienda (localActualId)
  if (tiendaIds.length > 0) {
    await prisma.usuario.updateMany({
      where: { negocioId, localActualId: { in: tiendaIds } },
      data: { localActualId: null }
    });
  }

  // 4) Entidades principales del negocio (orden para FK)
  await prisma.tienda.deleteMany({ where: { negocioId } });
  await prisma.usuario.deleteMany({ where: { negocioId } });
  await prisma.producto.deleteMany({ where: { negocioId } });
  await prisma.categoria.deleteMany({ where: { negocioId } });
  await prisma.proveedor.deleteMany({ where: { negocioId } });
  await prisma.rol.deleteMany({ where: { negocioId } });

  // 5) Finalmente, el Negocio
  await prisma.negocio.delete({ where: { id: negocioId } });

  console.log("Borrado completado para el negocio:", negocio.nombre, negocio.id);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
