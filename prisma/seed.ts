import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { seedDemoCatalogForTienda } from '../src/lib/onboarding/seedDemoCatalogForTienda';

const prisma = new PrismaClient();

const planes = [
  {
    nombre: 'FREEMIUM',
    descripcion: 'Plan gratuito por 7 días',
    limiteLocales: 20,
    limiteUsuarios: -1,
    limiteProductos: -1,
    precio: 0,
    moneda: 'USD',
    duracion: 7,
    recomendado: false,
    color: 'info',
    activo: true,
  },
  {
    nombre: 'BASICO',
    descripcion: 'Plan básico mensual',
    limiteLocales: 2,
    limiteUsuarios: 2,
    limiteProductos: 100,
    precio: 10,
    moneda: 'USD',
    duracion: 30,
    recomendado: false,
    color: 'primary',
    activo: true,
  },
  {
    nombre: 'SILVER',
    descripcion: 'Plan silver con usuarios ilimitados',
    limiteLocales: 5,
    limiteUsuarios: -1,
    limiteProductos: 500,
    precio: 20,
    moneda: 'USD',
    duracion: 30,
    recomendado: true,
    color: 'secondary',
    activo: true,
  },
  {
    nombre: 'PREMIUM',
    descripcion: 'Plan premium con productos ilimitados',
    limiteLocales: 20,
    limiteUsuarios: -1,
    limiteProductos: -1,
    precio: 30,
    moneda: 'USD',
    duracion: 30,
    recomendado: false,
    color: 'warning',
    activo: true,
  },
  {
    nombre: 'CUSTOM',
    descripcion: 'Plan personalizado según tus necesidades',
    limiteLocales: -1,
    limiteUsuarios: -1,
    limiteProductos: -1,
    precio: -1,
    moneda: 'USD',
    duracion: -1,
    recomendado: false,
    color: 'success',
    activo: true,
  },
];

// Todos los permisos disponibles en el sistema
const PERMISOS_ADMINISTRADOR = [
  'configuracion.usuarios.acceder',
  'configuracion.usuarios.cambiarpassword',
  'configuracion.usuarios.deleteOrDisable',
  'configuracion.locales.acceder',
  'configuracion.categorias.acceder',
  'configuracion.productos.acceder',
  'configuracion.productos.generar_codigo',
  'configuracion.proveedores.acceder',
  'configuracion.proveedores.liquidar',
  'configuracion.descuentos.acceder',
  'configuracion.descuentos.preview',
  'configuracion.destinostransferencia.acceder',
  'configuracion.roles.acceder',
  'configuracion.gastos.plantillas.gestionar',
  'recuperaciones.dashboard.acceder',
  'recuperaciones.inventario.acceder',
  'recuperaciones.resumencierres.acceder',
  'recuperaciones.analisiscpp.acceder',
  'recuperaciones.proveedoresconsignación.acceder',
  'operaciones.pos-venta.acceder',
  'operaciones.pos-venta.cancelarventa',
  'operaciones.pos-venta.gananciascostos',
  'operaciones.ventas.acceder',
  'operaciones.ventas.eliminar',
  'operaciones.conformarprecios.acceder',
  'operaciones.cierre.acceder',
  'operaciones.cierre.cerrar',
  'operaciones.cierre.gananciascostos',
  'operaciones.movimientos.acceder',
  'operaciones.movimientos.crear.compra',
  'operaciones.movimientos.crear.ajuste_entradas',
  'operaciones.movimientos.crear.ajuste_salidas',
  'operaciones.movimientos.crear.transferencia',
  'operaciones.movimientos.crear.recepcion',
  'operaciones.movimientos.crear.consignacion_entrada',
  'operaciones.movimientos.crear.consignacion_devolucion',
  'operaciones.gastos.ver',
  'operaciones.gastos.gestionar',
].join('|');

const PERMISOS_VENDEDOR = [
  'operaciones.pos-venta.acceder',
  'operaciones.pos-venta.cancelarventa',
  'operaciones.ventas.acceder',
  'operaciones.cierre.acceder',
  'operaciones.cierre.cerrar',
  'operaciones.gastos.ver',
].join('|');

const MONEDAS_INICIALES = [
  {
    code: 'CUP',
    nombre: 'Peso Cubano',
    simbolo: '$',
    denominaciones: [1000, 500, 200, 100, 50, 20, 10, 5, 3, 1],
  },
  {
    code: 'USD',
    nombre: 'Dólar Estadounidense',
    simbolo: 'USD',
    denominaciones: [100, 50, 20, 10, 5, 1],
  },
];

async function main() {
  console.log('Seeding monedas globales...');
  for (const m of MONEDAS_INICIALES) {
    await prisma.moneda.upsert({
      where: { code: m.code },
      update: { nombre: m.nombre, simbolo: m.simbolo },
      create: { code: m.code, nombre: m.nombre, simbolo: m.simbolo },
    });
    // Seed denominaciones solo si no existen aún
    const existentes = await prisma.denominacionBillete.count({ where: { monedaCode: m.code } });
    if (existentes === 0) {
      const denoms = m.denominaciones.map((valor, i) => ({
        monedaCode: m.code,
        valor,
        orden: m.denominaciones.length - i,
      }));
      await prisma.denominacionBillete.createMany({ data: denoms });
    }
    console.log(`  ✓ ${m.code} (${m.denominaciones.length} denominaciones)`);
  }
  console.log('Monedas seeded.\n');

  console.log('Seeding planes de negocio...');
  for (const plan of planes) {
    await prisma.plan.upsert({
      where: { nombre: plan.nombre },
      update: {},
      create: plan,
    });
    console.log(`  ✓ ${plan.nombre}`);
  }
  console.log('Seed completado.');

  // ──────────────────────────────────────────────────────────────────────
  // Categorías globales — corren en todos los entornos
  // ──────────────────────────────────────────────────────────────────────
  console.log('\nSeeding categorías globales...');
  const globalCategorias = [
    { nombre: 'Bebidas', color: '#2196F3' },
    { nombre: 'Bebidas Alcohólicas', color: '#1565C0' },
    { nombre: 'Snacks y Golosinas', color: '#FF9800' },
    { nombre: 'Lácteos', color: '#4CAF50' },
    { nombre: 'Panadería y Repostería', color: '#8D6E63' },
    { nombre: 'Carnes y Embutidos', color: '#E53935' },
    { nombre: 'Frutas y Verduras', color: '#66BB6A' },
    { nombre: 'Enlatados y Conservas', color: '#78909C' },
    { nombre: 'Cereales y Granos', color: '#FFA726' },
    { nombre: 'Condimentos y Salsas', color: '#EF5350' },
    { nombre: 'Congelados', color: '#29B6F6' },
    { nombre: 'Aseo del Hogar', color: '#AB47BC' },
    { nombre: 'Aseo Personal', color: '#9C27B0' },
    { nombre: 'Medicamentos y Salud', color: '#F44336' },
    { nombre: 'Electrónica y Accesorios', color: '#455A64' },
    { nombre: 'Papelería y Oficina', color: '#42A5F5' },
    { nombre: 'Ropa y Calzado', color: '#EC407A' },
    { nombre: 'Juguetes y Entretenimiento', color: '#FFCA28' },
    { nombre: 'Herramientas y Ferretería', color: '#607D8B' },
    { nombre: 'Otros', color: '#9E9E9E' },
  ];
  let globalCreadas = 0;
  for (const cat of globalCategorias) {
    const existe = await prisma.categoria.findFirst({
      where: { nombre: cat.nombre, negocioId: null }
    });
    if (!existe) {
      await prisma.categoria.create({
        data: { ...cat, esGlobal: true, negocioId: null }
      });
      globalCreadas++;
    }
  }
  console.log(`  ✓ Categorías globales (${globalCreadas} creadas, ${globalCategorias.length - globalCreadas} existentes)`);

  // ──────────────────────────────────────────────────────────────────────
  // Seed de desarrollo — solo fuera de producción
  // ──────────────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.log('\nSeeding datos de desarrollo...');

    const planFreemium = await prisma.plan.findUnique({ where: { nombre: 'FREEMIUM' } });
    const fiveYearsFromNow = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5);

    // ── 1. Negocio + Superadmin ───────────────────────────────────────
    let negocioId: string;
    const superadminExistente = await prisma.usuario.findUnique({ where: { usuario: 'superadmin' } });

    if (!superadminExistente) {
      const negocio = await prisma.negocio.create({
        data: {
          nombre: 'Negocio Demo',
          limitTime: fiveYearsFromNow,
          planId: planFreemium?.id ?? null,
        },
      });
      negocioId = negocio.id;
      await prisma.usuario.create({
        data: {
          usuario: 'superadmin',
          password: await bcrypt.hash(process.env.SUPER_ADMIN_PASS || '123456', 10),
          rol: 'SUPER_ADMIN',
          nombre: 'Super Admin',
          negocioId,
        },
      });
      console.log('  ✓ superadmin');
    } else {
      negocioId = superadminExistente.negocioId;
      console.log('  - superadmin ya existe');
    }

    // ── 2. Tienda principal ───────────────────────────────────────────
    let tienda = await prisma.tienda.findFirst({
      where: { negocioId, nombre: 'Tienda Principal' },
    });
    if (!tienda) {
      tienda = await prisma.tienda.create({
        data: { nombre: 'Tienda Principal', negocioId },
      });
      console.log('  ✓ Tienda Principal');
    } else {
      console.log('  - Tienda Principal ya existe');
    }

    // Asignar tiendaActual al superadmin si aún no tiene
    const superadmin = await prisma.usuario.findUnique({ where: { usuario: 'superadmin' } });
    if (superadmin && !superadmin.localActualId) {
      await prisma.usuario.update({
        where: { id: superadmin.id },
        data: { localActualId: tienda.id },
      });
    }

    // ── 3. Roles ──────────────────────────────────────────────────────
    let rolAdmin = await prisma.rol.findFirst({ where: { nombre: 'Administrador', negocioId } });
    if (!rolAdmin) {
      rolAdmin = await prisma.rol.create({
        data: {
          nombre: 'Administrador',
          descripcion: 'Acceso completo a todas las funciones',
          permisos: PERMISOS_ADMINISTRADOR,
          negocioId,
        },
      });
      console.log('  ✓ Rol Administrador');
    } else {
      console.log('  - Rol Administrador ya existe');
    }

    let rolVendedor = await prisma.rol.findFirst({ where: { nombre: 'Vendedor', negocioId } });
    if (!rolVendedor) {
      rolVendedor = await prisma.rol.create({
        data: {
          nombre: 'Vendedor',
          descripcion: 'Acceso a ventas y operaciones del punto de venta',
          permisos: PERMISOS_VENDEDOR,
          negocioId,
        },
      });
      console.log('  ✓ Rol Vendedor');
    } else {
      console.log('  - Rol Vendedor ya existe');
    }

    // ── 4. Usuarios de tienda ─────────────────────────────────────────
    let adminUser = await prisma.usuario.findUnique({ where: { usuario: 'admin' } });
    if (!adminUser) {
      adminUser = await prisma.usuario.create({
        data: {
          usuario: 'admin',
          password: await bcrypt.hash('admin123', 10),
          nombre: 'Administrador Demo',
          negocioId,
          localActualId: tienda.id,
        },
      });
      await prisma.usuarioTienda.create({
        data: { usuarioId: adminUser.id, tiendaId: tienda.id, rolId: rolAdmin.id },
      });
      console.log('  ✓ Usuario admin (pass: admin123)');
    } else {
      console.log('  - Usuario admin ya existe');
    }

    let vendedorUser = await prisma.usuario.findUnique({ where: { usuario: 'vendedor' } });
    if (!vendedorUser) {
      vendedorUser = await prisma.usuario.create({
        data: {
          usuario: 'vendedor',
          password: await bcrypt.hash('vendedor123', 10),
          nombre: 'Vendedor Demo',
          negocioId,
          localActualId: tienda.id,
        },
      });
      await prisma.usuarioTienda.create({
        data: { usuarioId: vendedorUser.id, tiendaId: tienda.id, rolId: rolVendedor.id },
      });
      console.log('  ✓ Usuario vendedor (pass: vendedor123)');
    } else {
      console.log('  - Usuario vendedor ya existe');
    }

    // ── 5–6. Categorías y productos demo ───────────────────────────────
    await seedDemoCatalogForTienda(prisma, negocioId, tienda.id);
    console.log('  ✓ Catálogo demo (categorías y productos)');

    // ── 7. Destinos de transferencia ──────────────────────────────────
    const transferDestsData = [
      { nombre: 'Efectivo', descripcion: 'Pago en efectivo', default: true },
      { nombre: 'Transferencia Bancaria', descripcion: 'Transferencia al banco', default: false },
    ];
    let transferCreados = 0;
    for (const td of transferDestsData) {
      const existe = await prisma.transferDestinations.findFirst({
        where: { nombre: td.nombre, tiendaId: tienda.id },
      });
      if (!existe) {
        await prisma.transferDestinations.create({ data: { ...td, tiendaId: tienda.id } });
        transferCreados++;
      }
    }
    console.log(`  ✓ Destinos de transferencia (${transferCreados} creados)`);

    // ── 8. Período activo (CierrePeriodo abierto) ─────────────────────
    const periodoAbierto = await prisma.cierrePeriodo.findFirst({
      where: { tiendaId: tienda.id, fechaFin: null },
    });
    if (!periodoAbierto) {
      await prisma.cierrePeriodo.create({
        data: { tiendaId: tienda.id, fechaInicio: new Date() },
      });
      console.log('  ✓ Período activo abierto');
    } else {
      console.log('  - Período activo ya existe');
    }

    // ── 9. Plantillas de gastos ───────────────────────────────────────
    const gastosPlantillasData = [
      {
        nombre: 'Renta del local',
        categoria: 'Infraestructura',
        tipoCalculo: 'MONTO_FIJO' as const,
        recurrencia: 'MENSUAL' as const,
        diaMes: 1,
        monto: 500,
        porcentaje: null,
      },
      {
        nombre: 'Internet',
        categoria: 'Servicios',
        tipoCalculo: 'MONTO_FIJO' as const,
        recurrencia: 'MENSUAL' as const,
        diaMes: 5,
        monto: 50,
        porcentaje: null,
      },
      {
        nombre: 'Comisión de ventas',
        categoria: 'Personal',
        tipoCalculo: 'PORCENTAJE_VENTAS' as const,
        recurrencia: 'DIARIO' as const,
        diaMes: null,
        monto: null,
        porcentaje: 3,
      },
    ];

    let plantillasCreadas = 0;
    for (const gp of gastosPlantillasData) {
      const { monto, porcentaje, ...plantillaData } = gp;
      let plantilla = await prisma.gastoPlantilla.findFirst({
        where: { nombre: gp.nombre, negocioId },
      });
      if (!plantilla) {
        plantilla = await prisma.gastoPlantilla.create({
          data: { ...plantillaData, negocioId },
        });
        plantillasCreadas++;
      }
      const gastoTiendaExiste = await prisma.gastoTienda.findFirst({
        where: { plantillaId: plantilla.id, tiendaId: tienda.id },
      });
      if (!gastoTiendaExiste) {
        await prisma.gastoTienda.create({
          data: {
            plantillaId: plantilla.id,
            tiendaId: tienda.id,
            negocioId,
            nombre: gp.nombre,
            categoria: gp.categoria,
            tipoCalculo: gp.tipoCalculo,
            recurrencia: gp.recurrencia,
            diaMes: gp.diaMes,
            monto,
            porcentaje,
          },
        });
      }
    }
    console.log(`  ✓ Plantillas de gastos (${plantillasCreadas} creadas)`);

    console.log('\n  Credenciales de acceso:');
    console.log('  ┌─────────────┬──────────────┬──────────────┐');
    console.log('  │ Usuario     │ Contraseña   │ Rol          │');
    console.log('  ├─────────────┼──────────────┼──────────────┤');
    console.log(`  │ superadmin  │ ${(process.env.SUPER_ADMIN_PASS || '123456').padEnd(12)} │ Super Admin  │`);
    console.log('  │ admin       │ admin123     │ Administrador│');
    console.log('  │ vendedor    │ vendedor123  │ Vendedor     │');
    console.log('  └─────────────┴──────────────┴──────────────┘');
    console.log('\nSeed dev completado.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
