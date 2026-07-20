import type { ITasaSnapshot, ITasaCambio } from "@/schemas/tasaCambio";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";

// CUP is the universal anchor — always 1. Rates are always expressed as "1 X = Y CUP".
const cupTasa = (code: string, tasas: ITasaSnapshot): number =>
  code === "CUP" ? 1 : (tasas[code] ?? 1);

// Tolerance for floating point noise before rounding up to a denomination —
// avoids Math.ceil bumping an exact multiple (e.g. 20.00000000000006) to the next one.
const EPS = 1e-6;

/**
 * Builds a tasa snapshot from the latest TasaCambio records per moneda.
 * CUP is always implicit at 1 and is never stored in the snapshot.
 * All rates are expressed as: 1 <code> = <tasa> CUP.
 */
export function buildTasaSnapshot(
  tasasCambio: Pick<ITasaCambio, "monedaCode" | "tasa" | "createdAt">[],
): ITasaSnapshot {
  const latest: Record<string, { tasa: number; createdAt: Date }> = {};

  for (const t of tasasCambio) {
    if (t.monedaCode === "CUP") continue;
    const prev = latest[t.monedaCode];
    if (!prev || t.createdAt > prev.createdAt) {
      latest[t.monedaCode] = { tasa: t.tasa, createdAt: t.createdAt };
    }
  }

  const snapshot: ITasaSnapshot = {};
  for (const [code, { tasa }] of Object.entries(latest)) {
    snapshot[code] = tasa;
  }
  return snapshot;
}

export type ITasaSnapshotMeta = {
  vigentes: ITasaSnapshot;
  actualizadoEn: string | null;
};

/**
 * Builds vigentes snapshot plus the most recent createdAt among included rates.
 * Filters out monedaBase and non-positive rates for app consumption.
 */
export function buildTasaSnapshotWithMeta(
  tasasCambio: Pick<ITasaCambio, "monedaCode" | "tasa" | "createdAt">[],
  monedaBase: string,
): ITasaSnapshotMeta {
  const latest: Record<string, { tasa: number; createdAt: Date }> = {};

  for (const t of tasasCambio) {
    if (t.monedaCode === "CUP" || t.monedaCode === monedaBase) continue;
    const prev = latest[t.monedaCode];
    if (!prev || t.createdAt > prev.createdAt) {
      latest[t.monedaCode] = { tasa: t.tasa, createdAt: t.createdAt };
    }
  }

  const vigentes: ITasaSnapshot = {};
  let maxCreatedAt: Date | null = null;

  for (const [code, { tasa, createdAt }] of Object.entries(latest)) {
    if (tasa <= 0) continue;
    vigentes[code] = tasa;
    if (!maxCreatedAt || createdAt > maxCreatedAt) {
      maxCreatedAt = createdAt;
    }
  }

  return {
    vigentes,
    actualizadoEn: maxCreatedAt?.toISOString() ?? null,
  };
}

/**
 * Converts monto in moneda → monedaBase, routing through CUP as the anchor.
 * Default monedaBase = 'CUP' (pure CUP conversion).
 */
export function convertToBase(
  monto: number,
  moneda: string,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  return (monto * cupTasa(moneda, tasas)) / cupTasa(monedaBase, tasas);
}

/**
 * Converts montoBase in monedaBase → moneda, routing through CUP as the anchor.
 * Default monedaBase = 'CUP'.
 */
export function convertFromBase(
  montoBase: number,
  moneda: string,
  tasas: ITasaSnapshot,
  monedaBase = "CUP",
): number {
  const tasa = cupTasa(moneda, tasas);
  if (tasa === 0) return 0;
  return (montoBase * cupTasa(monedaBase, tasas)) / tasa;
}

/**
 * Calculates change distribution across currencies.
 * All arithmetic routes through CUP anchor.
 */
export function calcularVuelto(
  totalBase: number,
  pagos: IPagoLinea[],
  monedaCobro: string,
  monedaBase: string,
  tasas: ITasaSnapshot,
  denominaciones: Record<string, number[]>,
): IVueltoLinea[] {
  const totalPagadoBase = pagos.reduce(
    (sum, p) => sum + convertToBase(p.monto, p.moneda, tasas, monedaBase),
    0,
  );
  const vueltoTotalBase = totalPagadoBase - totalBase;
  if (vueltoTotalBase < 0.0001) return [];

  const result: IVueltoLinea[] = [];

  if (monedaCobro !== monedaBase) {
    const vueltoEnMonedaCobroRaw = convertFromBase(
      vueltoTotalBase,
      monedaCobro,
      tasas,
      monedaBase,
    );
    const denomsOrdenadas = (denominaciones[monedaCobro] ?? [])
      .slice()
      .sort((a, b) => b - a);
    const denomMin = denomsOrdenadas.at(-1) ?? 1;
    // Siempre redondear el vuelto hacia arriba a la denominación disponible
    // (nunca hacia abajo): igual que el resto en monedaBase más abajo, para
    // no dar de menos por redondeo — Math.round podía rondar a la baja.
    const vueltoEnMonedaCobro =
      Math.ceil((vueltoEnMonedaCobroRaw - EPS) / denomMin) * denomMin;

    if (vueltoEnMonedaCobro > 0) {
      result.push({ moneda: monedaCobro, monto: vueltoEnMonedaCobro });
    }

    const restoBase =
      vueltoTotalBase -
      convertToBase(vueltoEnMonedaCobro, monedaCobro, tasas, monedaBase);

    if (restoBase > 0.0001) {
      const denomsBase = (denominaciones[monedaBase] ?? [])
        .slice()
        .sort((a, b) => b - a);
      const denomMinBase = denomsBase.at(-1) ?? 1;
      const vueltoEnBase =
        Math.ceil((restoBase - EPS) / denomMinBase) * denomMinBase;
      result.push({ moneda: monedaBase, monto: vueltoEnBase });
    }
  } else {
    const denomsBase = (denominaciones[monedaBase] ?? [])
      .slice()
      .sort((a, b) => b - a);
    const denomMinBase = denomsBase.at(-1) ?? 1;
    const vueltoEnBase =
      Math.ceil((vueltoTotalBase - EPS) / denomMinBase) * denomMinBase;
    if (vueltoEnBase > 0) {
      result.push({ moneda: monedaBase, monto: vueltoEnBase });
    }
  }

  return result;
}

/**
 * Formats a monetary amount with its currency symbol.
 * Falls back to the currency code if no symbol is provided.
 */
export function formatMoneda(
  monto: number,
  simbolo: string,
  decimales = 2,
): string {
  return `${simbolo}${monto.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })}`;
}

/**
 * True si la venta no tiene pagos registrados o tiene exactamente un pago
 * (una sola moneda y una sola forma de pago: efectivo O transferencia, no ambas).
 * Se usa para permitir/bloquear la eliminación de un producto individual de
 * una venta ya pagada: con más de un pago no hay forma de saber de cuál
 * descontar el monto del producto eliminado, así que directamente no se
 * reparte nada — se ajusta el único pago existente.
 */
export function pagadaConUnSoloPago(
  pagosDetalle?: Pick<IPagoLinea, "moneda">[] | null,
): boolean {
  return (pagosDetalle?.length ?? 0) <= 1;
}
