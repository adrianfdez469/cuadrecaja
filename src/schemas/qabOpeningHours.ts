import { z } from "zod";
import {
  QAB_OPENING_HOURS_DAYS,
  QAB_OPENING_HOURS_END_OF_DAY,
  QAB_OPENING_HOURS_END_OF_DAY_MINUTES,
  QAB_OPENING_HOURS_ISSUE_CODES,
  QAB_OPENING_HOURS_MAX_BYTES,
  QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY,
  QAB_OPENING_HOURS_VERSION,
} from "@/constants/qab";

/** NOT exported and NOT used to parse: it only exists to derive the output type. */
const openingHoursWindowShapeSchema = z.object({
  from: z.string(),
  to: z.string(),
});
const openingHoursDayShapeSchema = z.array(openingHoursWindowShapeSchema);
// Used only in a type position, which is the whole point: the authority on
// validity is `collectOpeningHoursIssues`, and a second parser would be a second
// answer to the same question (ADR 0031).
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const openingHoursShapeSchema = z.object({
  version: z.literal(QAB_OPENING_HOURS_VERSION),
  days: z.object({
    mon: openingHoursDayShapeSchema,
    tue: openingHoursDayShapeSchema,
    wed: openingHoursDayShapeSchema,
    thu: openingHoursDayShapeSchema,
    fri: openingHoursDayShapeSchema,
    sat: openingHoursDayShapeSchema,
    sun: openingHoursDayShapeSchema,
  }),
});

export type IOpeningHoursDay = (typeof QAB_OPENING_HOURS_DAYS)[number];
export type IOpeningHours = z.infer<typeof openingHoursShapeSchema>;
export type IOpeningHoursWindow = IOpeningHours["days"]["mon"][number];

export const openingHoursIssueSchema = z.object({
  code: z.enum(QAB_OPENING_HOURS_ISSUE_CODES),
  /** Locates the offender, e.g. ["days", "tue", 1, "from"]. [] means the root. */
  path: z.array(z.union([z.string(), z.number().int()])),
});
export type IOpeningHoursIssue = z.infer<typeof openingHoursIssueSchema>;
export type IOpeningHoursIssueCode = IOpeningHoursIssue["code"];

/** 24-hour "HH:MM". `"9:00"` and `"18:00:00"` fail; `"24:00"` is handled apart. */
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const ROOT_KEYS = ["version", "days"] as const;
const WINDOW_KEYS = ["from", "to"] as const;
const DAYS_KEY = "days";
const VERSION_KEY = "version";
const FROM_KEY = "from";
const TO_KEY = "to";
const MINUTES_PER_HOUR = 60;
const TIME_SEPARATOR = ":";

type IssuePathSegment = string | number;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

/** `true` when the string is a clock time, or the end-of-day marker in `to`. */
function isTimeLiteral(value: unknown, allowEndOfDay: boolean): value is string {
  if (typeof value !== "string") return false;
  if (allowEndOfDay && value === QAB_OPENING_HOURS_END_OF_DAY) return true;
  return CLOCK_TIME.test(value);
}

/** "09:00" -> 540, "24:00" -> 1440. Throws on anything else. */
export function openingHoursMinutes(time: string): number {
  if (time === QAB_OPENING_HOURS_END_OF_DAY) {
    return QAB_OPENING_HOURS_END_OF_DAY_MINUTES;
  }
  if (!CLOCK_TIME.test(time)) {
    throw new RangeError(`Not an opening-hours time: ${time}`);
  }
  const [hours, minutes] = time.split(TIME_SEPARATOR);
  return Number(hours) * MINUTES_PER_HOUR + Number(minutes);
}

/** A window whose two times are already known to be well formed. */
interface IParsedWindow {
  index: number;
  fromMinutes: number;
  toMinutes: number;
}

/**
 * The checks of one day that need every window of that day to be well formed.
 * Runs last, and only then: no point telling someone their windows overlap when
 * one of the two hours does not parse.
 */
function collectDayOrderIssues(
  day: IOpeningHoursDay,
  windows: IParsedWindow[],
  issues: IOpeningHoursIssue[],
): void {
  const crossesMidnight = (window: IParsedWindow): boolean =>
    window.toMinutes < window.fromMinutes;

  for (let i = 1; i < windows.length; i += 1) {
    const previous = windows[i - 1];
    const current = windows[i];
    const path: IssuePathSegment[] = [DAYS_KEY, day, current.index];

    // Strict ascending order by `from`. Out of order also makes the overlap
    // comparison meaningless, so only one of the two is reported per window.
    if (current.fromMinutes <= previous.fromMinutes) {
      issues.push({ code: "WINDOWS_UNORDERED", path });
      continue;
    }
    // Two windows that TOUCH do not overlap: 09:00-13:00 then 13:00-18:00 is a
    // legitimate split shift and the contract accepts it.
    if (current.fromMinutes < previous.toMinutes) {
      issues.push({ code: "WINDOWS_OVERLAP", path });
    }
  }

  const overnight = windows.filter(crossesMidnight);
  const last = windows[windows.length - 1];
  for (const window of overnight) {
    if (last !== undefined && window.index !== last.index) {
      issues.push({
        code: "OVERNIGHT_NOT_LAST",
        path: [DAYS_KEY, day, window.index],
      });
    }
  }
  for (const window of overnight.slice(1)) {
    issues.push({
      code: "MULTIPLE_OVERNIGHT",
      path: [DAYS_KEY, day, window.index],
    });
  }
}

/** Every check of one day, from the array itself down to each window. */
function collectDayIssues(
  day: IOpeningHoursDay,
  value: unknown,
  issues: IOpeningHoursIssue[],
): void {
  if (!Array.isArray(value)) {
    issues.push({ code: "DAY_NOT_AN_ARRAY", path: [DAYS_KEY, day] });
    return;
  }

  if (value.length > QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY) {
    issues.push({ code: "TOO_MANY_WINDOWS", path: [DAYS_KEY, day] });
  }

  const parsed: IParsedWindow[] = [];
  let everyWindowWellFormed = true;

  value.forEach((window, index) => {
    const windowPath: IssuePathSegment[] = [DAYS_KEY, day, index];

    if (!isPlainObject(window)) {
      issues.push({ code: "WINDOW_NOT_AN_OBJECT", path: windowPath });
      everyWindowWellFormed = false;
      return;
    }

    for (const key of Object.keys(window)) {
      if (!(WINDOW_KEYS as readonly string[]).includes(key)) {
        issues.push({ code: "UNKNOWN_KEY", path: [...windowPath, key] });
      }
    }

    const from = window[FROM_KEY];
    const to = window[TO_KEY];
    let fromWellFormed = true;
    let toWellFormed = true;

    // `from` first, then `to`: the order the contract fixes.
    if (!isTimeLiteral(from, true)) {
      issues.push({ code: "TIME_FORMAT_INVALID", path: [...windowPath, FROM_KEY] });
      fromWellFormed = false;
    }
    if (!isTimeLiteral(to, true)) {
      issues.push({ code: "TIME_FORMAT_INVALID", path: [...windowPath, TO_KEY] });
      toWellFormed = false;
    }

    // "24:00" parses as a time but is only ever legal in `to`.
    if (fromWellFormed && from === QAB_OPENING_HOURS_END_OF_DAY) {
      issues.push({ code: "END_OF_DAY_IN_FROM", path: [...windowPath, FROM_KEY] });
      fromWellFormed = false;
    }

    if (!fromWellFormed || !toWellFormed) {
      everyWindowWellFormed = false;
      return;
    }

    const fromMinutes = openingHoursMinutes(from as string);
    const toMinutes = openingHoursMinutes(to as string);

    if (fromMinutes === toMinutes) {
      issues.push({ code: "EMPTY_WINDOW", path: windowPath });
      everyWindowWellFormed = false;
      return;
    }

    parsed.push({ index, fromMinutes, toMinutes });
  });

  if (everyWindowWellFormed) {
    collectDayOrderIssues(day, parsed, issues);
  }
}

function collectDaysIssues(days: unknown, issues: IOpeningHoursIssue[]): void {
  if (!isPlainObject(days)) {
    issues.push({ code: "DAYS_NOT_AN_OBJECT", path: [DAYS_KEY] });
    return;
  }

  // Missing keys first, in mon..sun order, then the extra ones in the order they
  // appear. A `"lun"` produces BOTH: a DAY_UNKNOWN and a DAY_MISSING for `mon`.
  for (const day of QAB_OPENING_HOURS_DAYS) {
    if (!(day in days)) {
      issues.push({ code: "DAY_MISSING", path: [DAYS_KEY, day] });
    }
  }
  for (const key of Object.keys(days)) {
    if (!(QAB_OPENING_HOURS_DAYS as readonly string[]).includes(key)) {
      issues.push({ code: "DAY_UNKNOWN", path: [DAYS_KEY, key] });
    }
  }

  for (const day of QAB_OPENING_HOURS_DAYS) {
    if (day in days) collectDayIssues(day, days[day], issues);
  }
}

/** `JSON.stringify` size in bytes of UTF-8, or null when the value is not serialisable. */
function serialisedByteLength(input: unknown): number | null {
  let json: string | undefined;
  try {
    json = JSON.stringify(input);
  } catch {
    return null;
  }
  if (json === undefined) return null;
  // Bytes, not `String.length`: that one counts UTF-16 code units and would let
  // an accented calendar through at up to twice the size the contract accepts.
  return Buffer.byteLength(json, "utf8");
}

/** THE authority on validity. Pure, no I/O. An empty array means valid. */
export function collectOpeningHoursIssues(input: unknown): IOpeningHoursIssue[] {
  const issues: IOpeningHoursIssue[] = [];

  // FIRST, and it cuts: nothing else is reported about a calendar that is too
  // big to send, and nothing else walks a 2 MB structure to find out.
  const bytes = serialisedByteLength(input);
  if (bytes !== null && bytes > QAB_OPENING_HOURS_MAX_BYTES) {
    return [{ code: "SIZE_EXCEEDED", path: [] }];
  }

  if (!isPlainObject(input)) {
    return [{ code: "NOT_AN_OBJECT", path: [] }];
  }

  for (const key of Object.keys(input)) {
    // A `timezone` here lands as UNKNOWN_KEY, which is exactly what QAB does
    // with it: it rejects the whole STORE event.
    if (!(ROOT_KEYS as readonly string[]).includes(key)) {
      issues.push({ code: "UNKNOWN_KEY", path: [key] });
    }
  }

  if (input[VERSION_KEY] !== QAB_OPENING_HOURS_VERSION) {
    issues.push({ code: "VERSION_INVALID", path: [VERSION_KEY] });
  }

  collectDaysIssues(input[DAYS_KEY], issues);

  return issues;
}

/** Sugar over the above. */
export function isOpeningHours(input: unknown): input is IOpeningHours {
  return collectOpeningHoursIssues(input).length === 0;
}

/**
 * Same rules as `collectOpeningHoursIssues`, as a Zod schema, built with the
 * `z.unknown().transform((input, ctx) => ...)` pattern of `qabSlugSchema`. Each
 * issue becomes a `ctx.addIssue({ code: "custom", message: <ISSUE CODE>, path })`.
 */
export const openingHoursSchema: z.ZodType<IOpeningHours, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    const issues = collectOpeningHoursIssues(input);
    if (issues.length === 0) return input as IOpeningHours;

    for (const issue of issues) {
      // The message IS the code: the screen reads our closed vocabulary, never
      // a Zod sentence. See ADR 0031.
      ctx.addIssue({ code: "custom", message: issue.code, path: issue.path });
    }
    return z.NEVER;
  });
