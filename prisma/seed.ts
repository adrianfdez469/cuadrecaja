import { PrismaClient } from '@prisma/client';

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

async function main() {
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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
