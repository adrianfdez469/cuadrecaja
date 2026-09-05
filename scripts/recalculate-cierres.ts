/**
 * Recalculates the stored figures of closed periods from their current sales
 * (ADR 0036). Dry run by default: prints stored vs. recomputed per period and
 * writes nothing until `--apply` is given.
 *
 *   npx tsx scripts/recalculate-cierres.ts                 # every closed period, dry run
 *   npx tsx scripts/recalculate-cierres.ts --negocio <id>  # one business
 *   npx tsx scripts/recalculate-cierres.ts --cierre <id>   # one period
 *   npx tsx scripts/recalculate-cierres.ts --since 2026-06-01
 *   npx tsx scripts/recalculate-cierres.ts --only-drifted  # skip periods whose totalVentas already matches
 *   npx tsx scripts/recalculate-cierres.ts --apply         # write
 *
 * `--fix-venta-total` also rewrites `Venta.total` for sales whose stored total
 * diverges from their lines (clients used to store the raw sum of prices
 * across currencies). Dry run unless `--apply` is present too.
 *
 * Runs against DATABASE_URL: point it at the target database on purpose.
 */
import { prisma } from "../src/lib/prisma";
import {
  computeCierreTotals,
  hasTotalsDrift,
} from "../src/lib/cierre/computeCierreTotals";
import { loadCierreComputationInput } from "../src/lib/cierre/loadCierreInput";
import { persistCierreComputation } from "../src/lib/cierre/persistCierreTotals";
import { SALE_TOTAL_TOLERANCE_BASE } from "../src/constants/venta";

interface Args {
  apply: boolean;
  onlyDrifted: boolean;
  fixVentaTotal: boolean;
  negocio?: string;
  cierre?: string;
  since?: Date;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false, onlyDrifted: false, fixVentaTotal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--only-drifted") args.onlyDrifted = true;
    else if (a === "--fix-venta-total") args.fixVentaTotal = true;
    else if (a === "--negocio") args.negocio = argv[++i];
    else if (a === "--cierre") args.cierre = argv[++i];
    else if (a === "--since") args.since = new Date(argv[++i]);
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

const money = (n: number) => n.toFixed(2).padStart(12);

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const cierres = await prisma.cierrePeriodo.findMany({
    where: {
      fechaFin: { not: null },
      ...(args.cierre && { id: args.cierre }),
      ...(args.since && { fechaFin: { not: null, gte: args.since } }),
      ...(args.negocio && { tienda: { negocioId: args.negocio } }),
    },
    orderBy: { fechaFin: "asc" },
    select: {
      id: true,
      fechaFin: true,
      totalVentas: true,
      totalGanancia: true,
      totalsComputedAt: true,
      tienda: {
        select: {
          nombre: true,
          negocio: { select: { id: true, nombre: true, monedaBase: true } },
        },
      },
    },
  });

  console.log(
    `${cierres.length} closed period(s) — ${args.apply ? "APPLYING" : "dry run"}\n`,
  );
  console.log(
    "period   | negocio / tienda                 | base | ventas stored | ventas recalc | ganancia stored | ganancia recalc | state",
  );

  let drifted = 0;
  let written = 0;
  let ventaTotalsFixed = 0;

  for (const c of cierres) {
    const loaded = await loadCierreComputationInput(c.id, c.tienda.negocio.id);
    if (!loaded) continue;
    const computation = computeCierreTotals(loaded.input);
    const isDrifted = hasTotalsDrift(
      c.totalVentas,
      computation.totals.totalVentas,
    );
    if (isDrifted) drifted++;

    const state = isDrifted ? "DRIFTED" : c.totalsComputedAt ? "ok" : "legacy";
    if (args.onlyDrifted && !isDrifted) continue;

    console.log(
      `${c.id.slice(0, 8)} | ${`${c.tienda.negocio.nombre} / ${c.tienda.nombre}`.slice(0, 32).padEnd(32)} | ${c.tienda.negocio.monedaBase.padEnd(4)} | ${money(c.totalVentas)} | ${money(computation.totals.totalVentas)} | ${money(c.totalGanancia)}   | ${money(computation.totals.totalGanancia)}   | ${state}`,
    );

    if (args.fixVentaTotal) {
      for (const valued of computation.ventasValoradas) {
        const delta = Math.abs(
          (valued.sale.total ?? valued.ventaNeta) - valued.ventaNeta,
        );
        if (delta <= SALE_TOTAL_TOLERANCE_BASE) continue;
        ventaTotalsFixed++;
        console.log(
          `    venta ${valued.sale.id.slice(0, 8)}: total ${valued.sale.total} → ${valued.ventaNeta.toFixed(4)}`,
        );
        if (args.apply) {
          await prisma.venta.update({
            where: { id: valued.sale.id },
            data: { total: valued.ventaNeta },
          });
        }
      }
    }

    if (args.apply) {
      await prisma.$transaction((tx) =>
        persistCierreComputation(tx, c.id, computation),
      );
      written++;
    }
  }

  console.log(
    `\n${drifted} drifted, ${written} written, ${ventaTotalsFixed} sale total(s) ${args.apply ? "fixed" : "to fix"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
