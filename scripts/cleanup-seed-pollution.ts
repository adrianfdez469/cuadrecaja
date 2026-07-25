/**
 * Limpieza quirúrgica de la contaminación provocada por el seed de desarrollo
 * ejecutado accidentalmente en producción.
 *
 * CAUSA
 * -----
 * `package.json` ejecutaba `npx prisma db seed` en el `postinstall`. El bloque
 * de desarrollo de `prisma/seed.ts` está protegido por `NODE_ENV !== 'production'`,
 * pero durante la fase de *install* del build NODE_ENV no vale 'production', así
 * que el bloque corría igual. Ese bloque adopta el negocio del usuario
 * 'superadmin' (`seed.ts`: `negocioId = superadminExistente.negocioId`), que
 * cambia cada vez que el superadmin conmuta de negocio desde la app
 * (`/api/auth/cambiar-negocio` reescribe `Usuario.negocioId`). Resultado: el
 * negocio que estuviera seleccionado en el instante de cada deploy recibía una
 * tienda 'Tienda Principal' con el catálogo demo.
 *
 * QUÉ BORRA
 * ---------
 * Por cada tienda objetivo: movimientos, ProductoTienda, cierres (y sus tablas
 * hijas), gastos de tienda, destinos de transferencia, plantilla de ticket,
 * asignaciones de usuario y la tienda. Luego, por negocio, elimina únicamente
 * los Producto / Categoria / GastoPlantilla del demo que quedaron huérfanos.
 *
 * QUÉ NO BORRA
 * ------------
 * - Productos demo adoptados en tiendas reales (Cafetería la Napolitana tiene
 *   'Agua Mineral 500ml', 'Jabón de Baño' y 'Pasta Dental 75ml' con cientos de
 *   ventas; MiFamilia tiene 'Papas Fritas' en la tienda "Tienda").
 * - Categorías y plantillas de gasto que sigan en uso.
 * - Roles 'Administrador' / 'Vendedor' creados por el seed: se reportan, no se tocan.
 * - Negocio de Prueba: su 'Tienda Principal' tiene un TRASPASO_ENTRADA real.
 * - Ventas Eli / D&K Company: catálogo demo legítimo (onboarding con
 *   `incluirProductosPrueba`) y coincidencia de nombre, respectivamente.
 *
 * USO
 * ---
 *   npx tsx scripts/cleanup-seed-pollution.ts                  # dry-run (rollback forzado)
 *   npx tsx scripts/cleanup-seed-pollution.ts --apply          # ejecuta de verdad
 *   npx tsx scripts/cleanup-seed-pollution.ts --tienda=<id>    # limita a una tienda
 *
 * El dry-run ejecuta exactamente los mismos DELETE dentro de una transacción y
 * la revierte al final, así que los conteos que imprime son los reales.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_CATEGORIAS, DEMO_PRODUCTOS } from "../src/constants/demoCatalog";

const prisma = new PrismaClient();

const NOMBRE_TIENDA_SEED = "Tienda Principal";
const SUFIJO_ELIMINADO = "_ELIMINADO_";
const PLANTILLAS_GASTO_SEED = [
  "Renta del local",
  "Internet",
  "Comisión de ventas",
];
const ROLES_SEED = ["Administrador", "Vendedor"];

/**
 * Tiendas a limpiar. El `negocio` no se usa para buscar: es una aserción que se
 * verifica contra la BD antes de borrar nada, para que el script falle en vez de
 * tocar la tienda equivocada si los IDs quedaran obsoletos.
 */
const TIENDAS_OBJETIVO = [
  {
    tiendaId: "e4bf3205-886e-4361-99fa-75d9ee233d21",
    negocio: "Casa de Cristal",
  },
  { tiendaId: "9a31e926-1232-4833-9c32-9789fdc18092", negocio: "MiFamilia" },
  {
    tiendaId: "5fd970e4-a1a4-4e18-8467-0c22a10de571",
    negocio: "Cafetería la Napolitana",
  },
];

const NOMBRES_DEMO = new Set(DEMO_PRODUCTOS.map((p) => p.nombre));
const CATEGORIAS_DEMO = new Set(DEMO_CATEGORIAS.map((c) => c.nombre));

/** El borrado lógico de la app renombra a `<nombre>_ELIMINADO_<timestamp>`. */
function esProductoDemo(nombre: string): boolean {
  if (NOMBRES_DEMO.has(nombre)) return true;
  const corte = nombre.indexOf(SUFIJO_ELIMINADO);
  return corte > 0 && NOMBRES_DEMO.has(nombre.slice(0, corte));
}

class DryRunRollback extends Error {}

class AbortoPorGuarda extends Error {}

interface Resumen {
  [tabla: string]: number;
}

function sumar(resumen: Resumen, tabla: string, cantidad: number): void {
  if (cantidad > 0) resumen[tabla] = (resumen[tabla] ?? 0) + cantidad;
}

/**
 * Verifica que la tienda sea exactamente lo que el seed creó y que no haya
 * acumulado nada real. Cualquier desvío aborta el script completo: es preferible
 * no borrar nada a borrar de más.
 */
async function verificarGuardas(
  tiendaId: string,
  negocioEsperado: string,
): Promise<void> {
  const tienda = await prisma.tienda.findUnique({
    where: { id: tiendaId },
    include: { negocio: { select: { nombre: true } } },
  });

  if (!tienda) throw new AbortoPorGuarda(`Tienda ${tiendaId} no existe.`);
  if (tienda.nombre !== NOMBRE_TIENDA_SEED) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} se llama "${tienda.nombre}", no "${NOMBRE_TIENDA_SEED}".`,
    );
  }
  if (tienda.negocio.nombre !== negocioEsperado) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} pertenece a "${tienda.negocio.nombre}", se esperaba "${negocioEsperado}".`,
    );
  }

  const ventas = await prisma.venta.count({ where: { tiendaId } });
  if (ventas > 0)
    throw new AbortoPorGuarda(`Tienda ${tiendaId} tiene ${ventas} ventas.`);

  const cierresCerrados = await prisma.cierrePeriodo.count({
    where: { tiendaId, fechaFin: { not: null } },
  });
  if (cierresCerrados > 0) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} tiene ${cierresCerrados} cierres cerrados.`,
    );
  }

  // Un traspaso entrante significa que alguien movió mercancía real hacia acá.
  const movsEntrantes = await prisma.movimientoStock.count({
    where: { destinationId: tiendaId },
  });
  if (movsEntrantes > 0) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} tiene ${movsEntrantes} movimientos entrantes (traspasos).`,
    );
  }

  const productosTienda = await prisma.productoTienda.findMany({
    where: { tiendaId },
    select: { id: true, producto: { select: { nombre: true } } },
  });
  const noDemo = productosTienda.filter(
    (pt) => !esProductoDemo(pt.producto.nombre),
  );
  if (noDemo.length > 0) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} tiene ${noDemo.length} productos que no son del demo: ` +
        noDemo.map((pt) => pt.producto.nombre).join(", "),
    );
  }

  const idsProductoTienda = productosTienda.map((pt) => pt.id);
  if (idsProductoTienda.length > 0) {
    const vendidos = await prisma.ventaProducto.count({
      where: { productoTiendaId: { in: idsProductoTienda } },
    });
    if (vendidos > 0) {
      throw new AbortoPorGuarda(
        `Tienda ${tiendaId} tiene ${vendidos} líneas de venta sobre sus productos.`,
      );
    }
  }

  const destinos = await prisma.transferDestinations.findMany({
    where: { tiendaId },
    select: { id: true },
  });
  if (destinos.length > 0) {
    const ventasConDestino = await prisma.venta.count({
      where: { transferDestinationId: { in: destinos.map((d) => d.id) } },
    });
    if (ventasConDestino > 0) {
      throw new AbortoPorGuarda(
        `Tienda ${tiendaId}: ${ventasConDestino} ventas referencian sus destinos de transferencia.`,
      );
    }
  }

  const gastosTienda = await prisma.gastoTienda.findMany({
    where: { tiendaId },
    select: { id: true },
  });
  if (gastosTienda.length > 0) {
    const gastosEnCierres = await prisma.gastoCierre.count({
      where: { gastoTiendaId: { in: gastosTienda.map((g) => g.id) } },
    });
    if (gastosEnCierres > 0) {
      throw new AbortoPorGuarda(
        `Tienda ${tiendaId}: ${gastosEnCierres} gastos aplicados en cierres.`,
      );
    }
  }

  const liquidaciones = await prisma.productoProveedorLiquidacion.count({
    where: { cierre: { tiendaId } },
  });
  if (liquidaciones > 0) {
    throw new AbortoPorGuarda(
      `Tienda ${tiendaId} tiene ${liquidaciones} liquidaciones de proveedor.`,
    );
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const filtro = process.argv
    .find((a) => a.startsWith("--tienda="))
    ?.split("=")[1];

  const objetivos = filtro
    ? TIENDAS_OBJETIVO.filter((t) => t.tiendaId === filtro)
    : TIENDAS_OBJETIVO;

  if (objetivos.length === 0) {
    throw new Error(
      `--tienda=${filtro} no coincide con ninguna tienda objetivo.`,
    );
  }

  const host =
    process.env.DATABASE_URL?.match(/@([^/:]+)/)?.[1] ?? "desconocido";
  console.log(`\nBase de datos: ${host}`);
  console.log(
    `Modo: ${apply ? "⚠️  APPLY (los cambios se confirman)" : "DRY-RUN (se revierte al final)"}`,
  );
  console.log(`Tiendas objetivo: ${objetivos.length}\n`);

  console.log("── Verificando guardas ─────────────────────────────────");
  for (const { tiendaId, negocio } of objetivos) {
    await verificarGuardas(tiendaId, negocio);
    console.log(`  ✓ ${negocio}`);
  }
  console.log("");

  const resumen: Resumen = {};

  try {
    await prisma.$transaction(
      async (tx) => {
        for (const { tiendaId, negocio } of objetivos) {
          console.log(
            `── ${negocio} ${"─".repeat(Math.max(0, 46 - negocio.length))}`,
          );

          const { negocioId: idNegocio } = await tx.tienda.findUniqueOrThrow({
            where: { id: tiendaId },
            select: { negocioId: true },
          });

          const productosTienda = await tx.productoTienda.findMany({
            where: { tiendaId },
            select: { productoId: true },
          });
          const idsProducto = [
            ...new Set(productosTienda.map((pt) => pt.productoId)),
          ];

          const cierres = await tx.cierrePeriodo.findMany({
            where: { tiendaId },
            select: { id: true },
          });
          const idsCierre = cierres.map((c) => c.id);

          // 1. Movimientos de stock (incluye los AJUSTE_SALIDA de intentos de borrado previos).
          const movs = await tx.movimientoStock.deleteMany({
            where: { tiendaId },
          });
          sumar(resumen, "MovimientoStock", movs.count);
          console.log(`  MovimientoStock          ${movs.count}`);

          // 2. Vínculos producto-tienda.
          const pt = await tx.productoTienda.deleteMany({
            where: { tiendaId },
          });
          sumar(resumen, "ProductoTienda", pt.count);
          console.log(`  ProductoTienda           ${pt.count}`);

          // 3. Cierres y tablas hijas (varias son onDelete: Cascade, se borran explícito igual).
          if (idsCierre.length > 0) {
            const gc = await tx.gastoCierre.deleteMany({
              where: { cierreId: { in: idsCierre } },
            });
            sumar(resumen, "GastoCierre", gc.count);

            const ppl = await tx.productoProveedorLiquidacion.deleteMany({
              where: { cierreId: { in: idsCierre } },
            });
            sumar(resumen, "ProductoProveedorLiquidacion", ppl.count);

            const cbm = await tx.cashBreakdownMoneda.deleteMany({
              where: { cierrePeriodoId: { in: idsCierre } },
            });
            sumar(resumen, "CashBreakdownMoneda", cbm.count);

            const cbc = await tx.cashBreakdownCierre.deleteMany({
              where: { cierrePeriodoId: { in: idsCierre } },
            });
            sumar(resumen, "CashBreakdownCierre", cbc.count);

            const rmc = await tx.resumenMonedaCierre.deleteMany({
              where: { cierrePeriodoId: { in: idsCierre } },
            });
            sumar(resumen, "ResumenMonedaCierre", rmc.count);
          }
          const cp = await tx.cierrePeriodo.deleteMany({ where: { tiendaId } });
          sumar(resumen, "CierrePeriodo", cp.count);
          console.log(`  CierrePeriodo            ${cp.count}`);

          // 4. Configuración de la tienda.
          const gt = await tx.gastoTienda.deleteMany({ where: { tiendaId } });
          sumar(resumen, "GastoTienda", gt.count);
          console.log(`  GastoTienda              ${gt.count}`);

          const td = await tx.transferDestinations.deleteMany({
            where: { tiendaId },
          });
          sumar(resumen, "TransferDestinations", td.count);
          console.log(`  TransferDestinations     ${td.count}`);

          const tp = await tx.ticketPlantilla.deleteMany({
            where: { tiendaId },
          });
          sumar(resumen, "TicketPlantilla", tp.count);

          const ut = await tx.usuarioTienda.deleteMany({ where: { tiendaId } });
          sumar(resumen, "UsuarioTienda", ut.count);
          console.log(`  UsuarioTienda            ${ut.count}`);

          // 5. Usuarios que tenían esta tienda como local actual: quedan sin local
          //    y eligen uno al entrar (mismo estado que deja /api/auth/cambiar-negocio).
          const usr = await tx.usuario.updateMany({
            where: { localActualId: tiendaId },
            data: { localActualId: null },
          });
          sumar(resumen, "Usuario.localActualId → null", usr.count);
          if (usr.count > 0)
            console.log(`  Usuario.localActual→null ${usr.count}`);

          // 6. La tienda.
          await tx.tienda.delete({ where: { id: tiendaId } });
          sumar(resumen, "Tienda", 1);
          console.log(`  Tienda                   1`);

          // 7. Productos demo que quedaron sin ninguna tienda en todo el negocio.
          //    Los adoptados en tiendas reales sobreviven este filtro.
          const candidatos = await tx.producto.findMany({
            where: { id: { in: idsProducto } },
            select: {
              id: true,
              nombre: true,
              _count: {
                select: {
                  productosTienda: true,
                  prodProveedoresLiquidacion: true,
                },
              },
            },
          });

          const huerfanos = candidatos.filter(
            (p) =>
              p._count.productosTienda === 0 &&
              p._count.prodProveedoresLiquidacion === 0,
          );
          const idsHuerfanos = new Set(huerfanos.map((p) => p.id));
          const sobreviven = candidatos.filter((p) => !idsHuerfanos.has(p.id));

          if (huerfanos.length > 0) {
            const prod = await tx.producto.deleteMany({
              where: { id: { in: huerfanos.map((p) => p.id) } },
            });
            sumar(resumen, "Producto", prod.count);
            console.log(`  Producto (huérfanos)     ${prod.count}`);
          }
          if (sobreviven.length > 0) {
            console.log(
              `  Producto conservado      ${sobreviven.length} → ${sobreviven.map((p) => p.nombre).join(", ")}`,
            );
          }

          // 8. Categorías demo del negocio sin productos.
          const categorias = await tx.categoria.findMany({
            where: {
              negocioId: idNegocio,
              esGlobal: false,
              nombre: { in: [...CATEGORIAS_DEMO] },
            },
            select: {
              id: true,
              nombre: true,
              _count: { select: { productos: true } },
            },
          });
          const catsVacias = categorias.filter((c) => c._count.productos === 0);
          if (catsVacias.length > 0) {
            const cat = await tx.categoria.deleteMany({
              where: { id: { in: catsVacias.map((c) => c.id) } },
            });
            sumar(resumen, "Categoria", cat.count);
            console.log(
              `  Categoria (vacías)       ${cat.count} → ${catsVacias.map((c) => c.nombre).join(", ")}`,
            );
          }
          const catsEnUso = categorias.filter((c) => c._count.productos > 0);
          if (catsEnUso.length > 0) {
            console.log(
              `  Categoria conservada     ${catsEnUso.length} → ${catsEnUso.map((c) => c.nombre).join(", ")}`,
            );
          }

          // 9. Plantillas de gasto del seed sin ninguna tienda que las use.
          const plantillas = await tx.gastoPlantilla.findMany({
            where: {
              negocioId: idNegocio,
              nombre: { in: PLANTILLAS_GASTO_SEED },
            },
            select: {
              id: true,
              nombre: true,
              _count: { select: { asignaciones: true } },
            },
          });
          const plantillasVacias = plantillas.filter(
            (p) => p._count.asignaciones === 0,
          );
          if (plantillasVacias.length > 0) {
            const gp = await tx.gastoPlantilla.deleteMany({
              where: { id: { in: plantillasVacias.map((p) => p.id) } },
            });
            sumar(resumen, "GastoPlantilla", gp.count);
            console.log(
              `  GastoPlantilla (vacías)  ${gp.count} → ${plantillasVacias.map((p) => p.nombre).join(", ")}`,
            );
          }

          // 10. Roles del seed: solo se reportan. Borrarlos es riesgoso si alguien
          //     los seleccionó y no aporta a limpiar la tienda.
          const roles = await tx.rol.findMany({
            where: { negocioId: idNegocio, nombre: { in: ROLES_SEED } },
            select: {
              nombre: true,
              _count: { select: { usuariosTiendas: true } },
            },
          });
          const rolesSinUso = roles.filter(
            (r) => r._count.usuariosTiendas === 0,
          );
          if (rolesSinUso.length > 0) {
            console.log(
              `  ⓘ Roles del seed sin uso (NO se borran): ${rolesSinUso.map((r) => r.nombre).join(", ")}`,
            );
          }

          console.log("");
        }

        if (!apply) throw new DryRunRollback();
      },
      { maxWait: 20_000, timeout: 180_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  console.log("── Total ───────────────────────────────────────────────");
  for (const [tabla, cantidad] of Object.entries(resumen).sort()) {
    console.log(`  ${tabla.padEnd(30)} ${cantidad}`);
  }

  console.log(
    apply
      ? "\n✓ Cambios confirmados.\n"
      : "\n✓ Dry-run: la transacción se revirtió, la BD quedó intacta.\n  Volvé a correr con --apply para ejecutar.\n",
  );
}

main()
  .catch((e) => {
    if (e instanceof AbortoPorGuarda) {
      console.error(
        `\n✗ ABORTADO — una guarda falló, no se borró nada:\n  ${e.message}\n`,
      );
    } else {
      console.error(e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
