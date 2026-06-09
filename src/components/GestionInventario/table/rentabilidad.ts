import { convertToBase } from "@/lib/currency";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IProductoTiendaV2 } from "@/schemas/producto";

/**
 * Computes profitability as a percentage string. Purchase cost and sale price
 * can be expressed in different currencies (monedaCostoCode / monedaPrecioCode,
 * null = monedaBase), so both are converted to monedaBase before comparing.
 */
export function getRentabilidad(
  producto: IProductoTiendaV2,
  tasas: ITasaSnapshot,
  monedaBase: string,
): string {
  const { precio, costo, monedaPrecioCode, monedaCostoCode } = producto;
  if (!precio || !costo) return "—";

  const precioBase = convertToBase(
    precio,
    monedaPrecioCode ?? monedaBase,
    tasas,
    monedaBase,
  );
  const costoBase = convertToBase(
    costo,
    monedaCostoCode ?? monedaBase,
    tasas,
    monedaBase,
  );
  if (!costoBase) return "—";

  return `${(((precioBase - costoBase) / costoBase) * 100).toFixed(1)}%`;
}
