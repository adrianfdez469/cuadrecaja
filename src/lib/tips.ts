import { convertToBase } from "@/lib/currency";
import type { IPagoLinea, IVueltoLinea } from "@/schemas/pago";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";

/** Cent-level slack, so float noise never rejects an otherwise valid sale. */
const EPSILON = 0.01;

export interface TipValidationInput {
  tipTotal?: unknown;
  tipDetail?: unknown;
  pagosDetalle?: IPagoLinea[] | null;
  vueltoDetalle?: IVueltoLinea[] | null;
  tasaSnapshot?: ITasaSnapshot | null;
  /** The sale's own total, in base currency. */
  total: number;
  monedaBase: string;
}

/**
 * A flat shape rather than a discriminated union: `strictNullChecks` is off
 * in this project, and a boolean discriminant does not narrow reliably
 * without it — callers would have to cast to read `error`.
 */
export interface TipValidationResult {
  ok: boolean;
  error?: string;
  tipTotal: number;
  tipDetail: IPagoLinea[] | null;
}

const rejected = (error: string): TipValidationResult => ({
  ok: false,
  error,
  tipTotal: 0,
  tipDetail: null,
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Checks that a tip is actually backed by money the customer handed over.
 *
 * The tip is not recalculable from the cart the way a discount is — it is a
 * cashier's decision and has to be transported — so the server cannot derive
 * it. What it can do is verify the invariant the whole feature rests on:
 *
 *   Σ pagosDetalle(base) − Σ vueltoDetalle(base) − total  ≥  tipTotal
 *
 * Without this check a client could report a tip with no cash behind it,
 * which would inflate every tip report while the drawer stayed unchanged.
 */
export function validateTip({
  tipTotal,
  tipDetail,
  pagosDetalle,
  vueltoDetalle,
  tasaSnapshot,
  total,
  monedaBase,
}: TipValidationInput): TipValidationResult {
  const requested = Number(tipTotal) || 0;
  if (requested <= 0) return { ok: true, tipTotal: 0, tipDetail: null };

  if (!Array.isArray(tipDetail) || tipDetail.length === 0) {
    return rejected("tipDetail es requerido cuando la venta lleva propina");
  }

  const lines = tipDetail as IPagoLinea[];
  const malformed = lines.some(
    (line) =>
      !line ||
      typeof line.moneda !== "string" ||
      !(Number(line.monto) > 0) ||
      !(Number(line.equivalenteBase) >= 0),
  );
  if (malformed) {
    return rejected("tipDetail contiene líneas inválidas");
  }

  const detailTotal = round2(
    lines.reduce((sum, line) => sum + Number(line.equivalenteBase), 0),
  );
  if (Math.abs(detailTotal - requested) > EPSILON) {
    return rejected(
      `El desglose de propina (${detailTotal}) no coincide con el total (${requested})`,
    );
  }

  const tasas = tasaSnapshot ?? {};
  const paid = (pagosDetalle ?? []).reduce(
    (sum, pago) => sum + Number(pago.equivalenteBase ?? 0),
    0,
  );
  const change = (vueltoDetalle ?? []).reduce(
    (sum, vuelto) =>
      sum +
      convertToBase(Number(vuelto.monto), vuelto.moneda, tasas, monedaBase),
    0,
  );
  const overpayment = round2(paid - change - total);

  if (requested > overpayment + EPSILON) {
    return rejected(
      `La propina (${requested}) excede el excedente cobrado (${overpayment})`,
    );
  }

  return { ok: true, tipTotal: round2(requested), tipDetail: lines };
}

/** Aggregates the tips of a set of sales by currency and payment method. */
export interface ResumenPropinaMoneda {
  monedaCode: string;
  tipCash: number;
  tipTransfer: number;
  equivalenteBase: number;
}

/**
 * Parallel to `buildResumenMonedas`, deliberately kept separate: the cash
 * drawer already counts this money via `pagosDetalle`, so tips must never be
 * added to — or subtracted from — that total. This only answers "how much of
 * what is in the drawer is not ours".
 */
export function buildResumenPropinas(
  ventas: { tipDetail?: unknown; tasaSnapshot?: unknown }[],
  monedaBase: string,
  tasasFallback: ITasaSnapshot = {},
): ResumenPropinaMoneda[] {
  const map: Record<string, ResumenPropinaMoneda> = {};

  for (const venta of ventas) {
    if (!venta.tipDetail) continue;
    const lines = venta.tipDetail as IPagoLinea[];
    if (!Array.isArray(lines)) continue;
    const tasas = {
      ...tasasFallback,
      ...((venta.tasaSnapshot ?? {}) as ITasaSnapshot),
    };

    for (const line of lines) {
      if (!map[line.moneda]) {
        map[line.moneda] = {
          monedaCode: line.moneda,
          tipCash: 0,
          tipTransfer: 0,
          equivalenteBase: 0,
        };
      }
      if (line.tipo === "cash") map[line.moneda].tipCash += line.monto;
      else map[line.moneda].tipTransfer += line.monto;
      map[line.moneda].equivalenteBase += convertToBase(
        line.monto,
        line.moneda,
        tasas,
        monedaBase,
      );
    }
  }

  return Object.values(map);
}

/** Total tip of a set of sales, in base currency. */
export function totalPropinasBase(
  ventas: { tipTotal?: number | null }[],
): number {
  return round2(ventas.reduce((sum, venta) => sum + (venta.tipTotal ?? 0), 0));
}
