import { startOfNextDay } from "@/utils/date";
import type {
  IDateRange,
  IReportBucketing,
  IReportPeriod,
} from "@/schemas/reports/common";

/** Thrown when the caller sends an unusable period/date combination. */
export class InvalidReportRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReportRangeError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Resolves a period preset into a concrete date range.
 *
 * Extracted verbatim from the inline switch that used to live in the dashboard
 * route, so every report shares one definition of what "este mes" means.
 */
export function resolveDateRange(
  period: string | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
  now: Date = new Date(),
): IDateRange {
  const to = new Date(now);
  let from: Date;

  switch (period as IReportPeriod) {
    case "dia":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "semana":
      from = new Date(now);
      from.setDate(now.getDate() - 7);
      break;
    case "anio":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "personalizado": {
      if (!startDate) {
        throw new InvalidReportRangeError(
          "Fecha de inicio requerida para período personalizado",
        );
      }
      from = new Date(startDate);
      if (Number.isNaN(from.getTime())) {
        throw new InvalidReportRangeError("Fecha de inicio inválida");
      }
      if (endDate) {
        const parsedEnd = new Date(endDate);
        if (Number.isNaN(parsedEnd.getTime())) {
          throw new InvalidReportRangeError("Fecha de fin inválida");
        }
        // End date is inclusive for the user, so extend to the next midnight.
        return { from, to: startOfNextDay(parsedEnd) };
      }
      break;
    }
    case "mes":
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  return { from, to };
}

/**
 * The immediately-preceding window of identical width, for period-over-period
 * comparison.
 */
export function previousRange(range: IDateRange): IDateRange {
  const width = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - width),
    to: new Date(range.from.getTime()),
  };
}

/** Picks a sensible time-series granularity from how wide the range is. */
export function resolveBucketing(range: IDateRange): IReportBucketing {
  const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  if (days <= 62) return "day";
  if (days <= 366) return "week";
  return "month";
}

/** Monday of the ISO week containing `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = Sunday. Shift so Monday starts the week.
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

/**
 * Stable, sortable bucket key for a timestamp. Keys are local-time based so the
 * buckets line up with the business day the user experienced.
 */
export function bucketKey(date: Date, granularity: IReportBucketing): string {
  const anchor =
    granularity === "week"
      ? startOfWeek(date)
      : granularity === "month"
        ? new Date(date.getFullYear(), date.getMonth(), 1)
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const year = anchor.getFullYear();
  const month = String(anchor.getMonth() + 1).padStart(2, "0");
  if (granularity === "month") return `${year}-${month}`;

  const day = String(anchor.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Every bucket key in the range, so gaps can be rendered as "no data". */
export function enumerateBuckets(
  range: IDateRange,
  granularity: IReportBucketing,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const cursor = new Date(range.from);

  while (cursor.getTime() < range.to.getTime()) {
    const key = bucketKey(cursor, granularity);
    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

/** Whole days spanned by a range, floored at 1 to stay safe as a divisor. */
export function rangeDays(range: IDateRange): number {
  const days = Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS);
  return Math.max(1, days);
}
