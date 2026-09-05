import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ICierreData } from "@/schemas/cierre";
import { getSession } from "@/utils/auth";
import { verificarPermisoUsuario } from "@/utils/permisos_back";
import {
  computeCierreTotals,
  hasTotalsDrift,
  type CierreComputation,
  type CierreStoredTotals,
  type ValuedSale,
} from "@/lib/cierre/computeCierreTotals";
import { loadCierreComputationInput } from "@/lib/cierre/loadCierreInput";

type Params = { tiendaId: string; cierreId: string };

type ProductoVentaAcumulado = ICierreData["productosVendidos"][number];

/**
 * Sold products grouped for the table. The grouping key includes cost and
 * price only for users allowed to see them, so the rest see one row per
 * product regardless of price changes during the period.
 */
function buildProductosVendidos(
  ventasValoradas: ValuedSale[],
  canViewCostos: boolean,
): ProductoVentaAcumulado[] {
  const productosVendidos: Record<string, ProductoVentaAcumulado> = {};

  for (const valued of ventasValoradas) {
    // Lines of THIS sale by productoTiendaId, to spread its discounts.
    const lineasPorPt: Record<
      string,
      { productoKey: string; subtotal: number }[]
    > = {};

    for (const line of valued.lineas) {
      const { productoTiendaId: id, proveedor } = line;
      const productoKey = canViewCostos
        ? proveedor
          ? `${id}-${proveedor.id}-${line.costoBase}-${line.precioBase}`
          : `${id}-${line.costoBase}-${line.precioBase}`
        : proveedor
          ? `${id}-${proveedor.id}`
          : id;

      if (!productosVendidos[productoKey]) {
        productosVendidos[productoKey] = {
          nombre: line.nombre,
          costo: line.costoBase,
          precio: line.precioBase,
          cantidad: 0,
          total: 0,
          ganancia: 0,
          descuento: 0,
          id: productoKey,
          productoId: line.productoId,
          ...(proveedor && { proveedor, enConsignacion: true }),
        };
      }
      productosVendidos[productoKey].cantidad += line.cantidad;
      productosVendidos[productoKey].total += line.totalProducto;
      productosVendidos[productoKey].ganancia += line.gananciaProducto;

      (lineasPorPt[id] ??= []).push({
        productoKey,
        subtotal: line.totalProducto,
      });
    }

    for (const ad of valued.sale.appliedDiscounts) {
      const amount = Number(ad.amount || 0);
      if (amount <= 0) continue;

      const affected = Array.isArray(ad.productsAffected)
        ? (ad.productsAffected as { productoTiendaId?: string }[])
            .map((x) => String(x?.productoTiendaId || ""))
            .filter(Boolean)
        : Object.keys(lineasPorPt);

      const contribuciones = affected.flatMap(
        (ptId) => lineasPorPt[ptId] ?? [],
      );
      const subtotalAfectado = contribuciones.reduce(
        (acc, it) => acc + (Number(it.subtotal) || 0),
        0,
      );
      if (subtotalAfectado <= 0) continue;

      let acumulado = 0;
      contribuciones.forEach((it, idx) => {
        const isLast = idx === contribuciones.length - 1;
        const share = isLast
          ? amount - acumulado
          : amount * (it.subtotal / subtotalAfectado);
        acumulado += share;
        const row = productosVendidos[it.productoKey];
        if (row) row.descuento = (row.descuento || 0) + share;
      });
    }
  }

  return Object.values(productosVendidos)
    .map((p) => ({ ...p, descuento: Number(p.descuento || 0) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * GET /api/cierre/[tiendaId]/[cierreId]
 *
 * An open period is valued live. A closed period shows the figures stored at
 * the close (ADR 0036): the live computation is still run, but only to
 * group the products and to detect that the sales changed after the close —
 * `totalesDesactualizados` — so the screen can offer the recalculation
 * instead of silently showing two different truths.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Params> },
): Promise<NextResponse<ICierreData | { error: string }>> {
  try {
    const { tiendaId, cierreId } = await params;

    const session = await getSession();
    const user = session.user;

    const loaded = await loadCierreComputationInput(cierreId, user.negocio.id);
    if (!loaded || loaded.cierre.tiendaId !== tiendaId) {
      throw new Error("Cierre no encontrado");
    }
    const { cierre, input } = loaded;

    const computation = computeCierreTotals(input);

    // A period closed by the previous engine (totalsComputedAt null) has no
    // stored gross/discount figures nor per-currency gross: it keeps being
    // valued live until the recalculation backfills it.
    const usesStored = Boolean(cierre.fechaFin && cierre.totalsComputedAt);
    const stored = usesStored ? await loadStored(cierreId) : null;

    const totals: CierreStoredTotals = stored?.totals ?? computation.totals;
    const resumenMonedas = (
      stored?.resumenMonedas ?? computation.resumenMonedas
    ).map((r) => ({ ...r, id: r.monedaCode }));
    const totalesDesactualizados = cierre.fechaFin
      ? hasTotalsDrift(
          stored?.totals.totalVentas ?? computation.totals.totalVentas,
          computation.totals.totalVentas,
        ) || !cierre.totalsComputedAt
      : false;

    const tienda = await prisma.tienda.findFirstOrThrow({
      where: { id: tiendaId, negocioId: user.negocio.id },
    });

    const canViewCostos = verificarPermisoUsuario(
      user.permisos,
      "operaciones.cierre.gananciascostos",
      user.rol,
    );

    const cierreData: ICierreData = {
      fechaInicio: cierre.fechaInicio,
      fechaFin: cierre.fechaFin ?? undefined,
      tienda,
      ...totals,
      totalVentasPropiasNeto: computation.totalVentasPropiasNeto,
      totalVentasConsignacionNeto: computation.totalVentasConsignacionNeto,
      totalTransferenciasByDestination:
        computation.totalTransferenciasByDestination,
      totalVentasPorUsuario: computation.totalVentasPorUsuario,
      tipsPorUsuario: computation.tipsPorUsuario,
      gananciaDeducciones: computation.gananciaDeducciones,
      cajaDeducciones: computation.cajaDeducciones,
      resumenMonedas,
      productosVendidos: buildProductosVendidos(
        computation.ventasValoradas,
        canViewCostos,
      ),
      totalesDesactualizados,
      totalsComputedAt: cierre.totalsComputedAt ?? undefined,
    };
    return NextResponse.json(cierreData);
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al obtener los datos del cierre" },
      { status: 500 },
    );
  }
}

async function loadStored(cierreId: string): Promise<{
  totals: CierreStoredTotals;
  resumenMonedas: CierreComputation["resumenMonedas"];
}> {
  const row = await prisma.cierrePeriodo.findUniqueOrThrow({
    where: { id: cierreId },
    select: {
      totalVentas: true,
      totalVentasBrutas: true,
      totalDescuentos: true,
      totalInversion: true,
      totalGanancia: true,
      totalTransferencia: true,
      totalVentasPropias: true,
      totalVentasConsignacion: true,
      totalGananciasPropias: true,
      totalGananciasConsignacion: true,
      totalGastos: true,
      totalGananciaFinal: true,
      totalComprasCaja: true,
      totalMerma: true,
      totalDevoluciones: true,
      totalTips: true,
      resumenMonedas: {
        select: {
          monedaCode: true,
          totalEfectivo: true,
          totalTransfer: true,
          equivalenteBase: true,
          totalEfectivoBruto: true,
          equivalenteBaseBruto: true,
          initialFund: true,
          tipCash: true,
          tipTransfer: true,
        },
      },
    },
  });
  const { resumenMonedas, ...totals } = row;
  return { totals, resumenMonedas };
}
