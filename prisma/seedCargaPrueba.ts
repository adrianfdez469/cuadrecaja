/**
 * Carga de prueba: inserta un catálogo grande en una tienda para poder medir
 * el POS con volumen realista.
 *
 * Todo lo que crea queda marcado con `MARCA` en `Producto.descripcion`, así que
 * se puede borrar entero y sin ambigüedad:
 *
 *   npx tsx prisma/seedCargaPrueba.ts --limpiar
 *
 * Solo escribe sobre la base de `DATABASE_URL`. Comprueba que apunte a tu base
 * local antes de ejecutarlo.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Marca que identifica lo insertado por este script. No cambiarla. */
const MARCA = "CARGA_PRUEBA_POS";

const TIENDA_NOMBRE = process.env.TIENDA ?? "Tienda Principal";
const CANTIDAD = Number(process.env.CANTIDAD ?? 2000);

// Nombres compuestos para que la búsqueda tenga algo real que filtrar: con
// 2000 productos llamados igual, teclear no discrimina nada.
const BASES = [
  "Agua Mineral",
  "Refresco Cola",
  "Cerveza",
  "Jugo Natural",
  "Café Molido",
  "Leche Entera",
  "Yogurt",
  "Queso Blanco",
  "Mantequilla",
  "Huevos",
  "Arroz",
  "Frijol Negro",
  "Aceite Vegetal",
  "Azúcar",
  "Sal",
  "Pan de Molde",
  "Galletas",
  "Chocolate",
  "Caramelos",
  "Papas Fritas",
  "Jabón de Baño",
  "Champú",
  "Pasta Dental",
  "Papel Higiénico",
  "Detergente",
  "Cloro",
  "Esponja",
  "Escoba",
  "Bombillo LED",
  "Pilas AA",
  "Cuaderno",
  "Bolígrafo",
  "Cinta Adhesiva",
  "Destornillador",
  "Martillo",
  "Pollo Congelado",
  "Carne Molida",
  "Jamón",
  "Salchicha",
  "Atún en Lata",
];

const MARCAS = [
  "Ciego Montero",
  "Bucanero",
  "Tropical",
  "La Estancia",
  "Serrano",
  "Rioja",
  "Doña Neli",
  "El Gallito",
  "Sabroso",
  "Del Valle",
  "Nutri",
  "Premium",
  "Clásico",
  "Familiar",
  "Económico",
];

const PRESENTACIONES = [
  "500ml",
  "1L",
  "1.5L",
  "250g",
  "500g",
  "1kg",
  "Paquete x6",
  "Paquete x12",
  "Unidad",
  "Caja",
  "Bolsa",
  "Sobre",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function limpiar() {
  const productos = await prisma.producto.findMany({
    where: { descripcion: MARCA },
    select: { id: true },
  });
  if (productos.length === 0) {
    console.log("No hay productos de carga de prueba que borrar.");
    return;
  }
  const ids = productos.map((p) => p.id);
  console.log(`Borrando ${ids.length} productos de carga de prueba...`);

  // En orden de dependencia: movimientos y ventas primero, si los hubiera.
  const productosTienda = await prisma.productoTienda.findMany({
    where: { productoId: { in: ids } },
    select: { id: true },
  });
  const ptIds = productosTienda.map((pt) => pt.id);

  await prisma.movimientoStock.deleteMany({
    where: { productoTiendaId: { in: ptIds } },
  });
  await prisma.ventaProducto.deleteMany({
    where: { productoTiendaId: { in: ptIds } },
  });
  await prisma.productoTienda.deleteMany({
    where: { productoId: { in: ids } },
  });
  await prisma.codigoProducto.deleteMany({
    where: { productoId: { in: ids } },
  });
  await prisma.producto.deleteMany({ where: { id: { in: ids } } });

  console.log("Listo. La tienda queda como estaba.");
}

async function sembrar() {
  const tienda = await prisma.tienda.findFirst({
    where: { nombre: TIENDA_NOMBRE },
    select: { id: true, nombre: true, negocioId: true },
  });
  if (!tienda) {
    throw new Error(`No existe la tienda "${TIENDA_NOMBRE}"`);
  }

  const yaExisten = await prisma.producto.count({
    where: { descripcion: MARCA, negocioId: tienda.negocioId },
  });
  if (yaExisten > 0) {
    console.log(
      `Ya hay ${yaExisten} productos de carga de prueba. Ejecuta con --limpiar antes de volver a sembrar.`,
    );
    return;
  }

  // Categorías del negocio más las globales: así las píldoras del POS tienen
  // variedad y el filtro por categoría se puede probar de verdad.
  const categorias = await prisma.categoria.findMany({
    where: { OR: [{ negocioId: tienda.negocioId }, { negocioId: null }] },
    select: { id: true },
  });
  if (categorias.length === 0)
    throw new Error("El negocio no tiene categorías");

  console.log(
    `Sembrando ${CANTIDAD} productos en "${tienda.nombre}" (${categorias.length} categorías disponibles)...`,
  );

  const productos = Array.from({ length: CANTIDAD }, (_, i) => ({
    id: crypto.randomUUID(),
    nombre: `${pick(BASES, i)} ${pick(MARCAS, i * 7)} ${pick(PRESENTACIONES, i * 3)} #${i + 1}`,
    descripcion: MARCA,
    // Uno de cada veinte admite decimales, para probar el stepper fraccionado.
    permiteDecimal: i % 20 === 0,
    categoriaId: pick(categorias, i * 11).id,
    negocioId: tienda.negocioId,
  }));

  await prisma.producto.createMany({ data: productos });
  console.log("  productos creados");

  const productosTienda = productos.map((p, i) => ({
    id: crypto.randomUUID(),
    tiendaId: tienda.id,
    productoId: p.id,
    costo: Math.round((0.5 + (i % 40) * 0.35) * 100) / 100,
    precio: Math.round((1 + (i % 60) * 0.55) * 100) / 100,
    // Uno de cada veinticinco sin existencia, para que el POS tenga también
    // productos agotados que mostrar.
    existencia: i % 25 === 0 ? 0 : 5 + (i % 120),
    // Uno de cada diez con precio en CUP, para ejercitar el multimoneda.
    monedaPrecioCode: i % 10 === 0 ? "CUP" : null,
  }));

  // En lotes: 2000 filas de una vez sobre el pooler local es más frágil que
  // dividirlas, y el progreso se ve.
  const LOTE = 500;
  for (let i = 0; i < productosTienda.length; i += LOTE) {
    await prisma.productoTienda.createMany({
      data: productosTienda.slice(i, i + LOTE),
    });
    console.log(
      `  productoTienda ${Math.min(i + LOTE, productosTienda.length)}/${productosTienda.length}`,
    );
  }

  // Códigos de barras para la mitad, para poder probar el escáner.
  const codigos = productos
    .filter((_, i) => i % 2 === 0)
    .map((p, i) => ({
      id: crypto.randomUUID(),
      codigo: `7${String(500000000 + i).padStart(12, "0")}`,
      productoId: p.id,
      negocioId: tienda.negocioId,
    }));
  for (let i = 0; i < codigos.length; i += LOTE) {
    await prisma.codigoProducto.createMany({
      data: codigos.slice(i, i + LOTE),
    });
  }
  console.log(`  ${codigos.length} códigos de barras creados`);

  console.log(
    `\nListo. Para deshacerlo:  npx tsx prisma/seedCargaPrueba.ts --limpiar`,
  );
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      "DATABASE_URL no apunta a localhost. Este script solo debe correr contra la base local.",
    );
  }
  if (process.argv.includes("--limpiar")) {
    await limpiar();
  } else {
    await sembrar();
  }
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
