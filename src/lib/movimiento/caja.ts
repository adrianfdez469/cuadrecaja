import { convertToBase } from "@/lib/currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

type ResumenEntry = {
  totalEfectivo: number;
  totalTransfer: number;
  equivalenteBase: number;
};

type MovimientoCajaRelevante = {
  tipo: string;
  formaPago?: string | null;
  costoTotal?: number | null;
  montoReembolso?: number | null;
  monedaOriginal?: string | null;
  montoOriginal?: number | null;
};

/**
 * Descuenta de la caja del período (por moneda) las compras de mercancía pagadas
 * con efectivo de caja y los reembolsos por devolución de venta. No toca ganancia
 * (eso se calcula aparte con totalMerma/totalDevoluciones sobre totalGananciaFinal).
 */
export function applyComprasYDevolucionesToResumenMap(
  map: Record<string, ResumenEntry>,
  movimientos: MovimientoCajaRelevante[],
  monedaBase: string,
  tasas: ITasaSnapshot,
): void {
  for (const m of movimientos) {
    if (m.tipo === "COMPRA" && m.formaPago === "EFECTIVO_CAJA") {
      const moneda = m.monedaOriginal ?? monedaBase;
      const montoEnMoneda = m.montoOriginal ?? m.costoTotal ?? 0;
      // costoTotal de una COMPRA se guarda en la moneda de la compra, no en
      // monedaBase — hay que convertirlo explícitamente.
      const enBase = convertToBase(montoEnMoneda, moneda, tasas, monedaBase);
      if (!map[moneda]) {
        map[moneda] = {
          totalEfectivo: 0,
          totalTransfer: 0,
          equivalenteBase: 0,
        };
      }
      map[moneda].totalEfectivo -= montoEnMoneda;
      map[moneda].equivalenteBase -= enBase;
    } else if (m.tipo === "DEVOLUCION_VENTA") {
      const moneda = m.monedaOriginal ?? monedaBase;
      const montoEnMoneda = m.montoOriginal ?? m.montoReembolso ?? 0;
      // montoReembolso ya viene en monedaBase (convertido con la tasa
      // histórica de la venta original al crear la devolución)
      const enBase = m.montoReembolso ?? montoEnMoneda;
      if (!map[moneda]) {
        map[moneda] = {
          totalEfectivo: 0,
          totalTransfer: 0,
          equivalenteBase: 0,
        };
      }
      map[moneda].totalEfectivo -= montoEnMoneda;
      map[moneda].equivalenteBase -= enBase;
    }
  }
}
