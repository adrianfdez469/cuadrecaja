import {
  QAB_OPENING_HOURS_DAYS,
  QAB_OPENING_HOURS_END_OF_DAY,
  QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY,
  QAB_OPENING_HOURS_VERSION,
} from "@/constants/qab";
import { TIENDA_ONLINE_UI } from "@/constants/tiendaOnline";
import { openingHoursMinutes } from "@/schemas/qabOpeningHours";
import type {
  IOpeningHours,
  IOpeningHoursDay,
  IOpeningHoursIssue,
  IOpeningHoursIssueCode,
  IOpeningHoursWindow,
} from "@/schemas/qabOpeningHours";

/** The seven day keys, in Spanish, for the merchant. */
export const DAY_LABELS: Record<IOpeningHoursDay, string> = {
  mon: "Lunes",
  tue: "Martes",
  wed: "Miércoles",
  thu: "Jueves",
  fri: "Viernes",
  sat: "Sábado",
  sun: "Domingo",
};

const CLOSED_SUMMARY = "Cerrado";
const ALL_DAY_SUMMARY = "Abierto las 24 horas";
const WINDOW_SEPARATOR = " · ";
const RANGE_SEPARATOR = "–";

/**
 * The codes only a calendar STORED before this feature could produce: the
 * editor's own model is always seven day keys of arrays of `{from, to}`, so it
 * cannot build any of these. They replace the editor instead of annotating it.
 */
const STRUCTURAL_CODES: readonly IOpeningHoursIssueCode[] = [
  "SIZE_EXCEEDED",
  "NOT_AN_OBJECT",
  "UNKNOWN_KEY",
  "VERSION_INVALID",
  "DAYS_NOT_AN_OBJECT",
  "DAY_MISSING",
  "DAY_UNKNOWN",
  "DAY_NOT_AN_ARRAY",
  "WINDOW_NOT_AN_OBJECT",
];

export function isStructuralIssue(issue: IOpeningHoursIssue): boolean {
  return STRUCTURAL_CODES.includes(issue.code);
}

/** Seven closed days. NOT the same thing as «no calendar configured». */
export function emptyOpeningHours(): IOpeningHours {
  return {
    version: QAB_OPENING_HOURS_VERSION,
    days: {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    },
  };
}

export function defaultWindow(): IOpeningHoursWindow {
  return {
    from: TIENDA_ONLINE_UI.defaultWindowFrom,
    to: TIENDA_ONLINE_UI.defaultWindowTo,
  };
}

export function isAllDay(windows: IOpeningHoursWindow[]): boolean {
  return (
    windows.length === 1 &&
    windows[0].from === TIENDA_ONLINE_UI.startOfDay &&
    windows[0].to === QAB_OPENING_HOURS_END_OF_DAY
  );
}

export function canAddWindow(windows: IOpeningHoursWindow[]): boolean {
  return windows.length < QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY;
}

/** `Cerrado`, `Abierto las 24 horas`, or the windows joined by ` · `. */
export function summarizeDay(windows: IOpeningHoursWindow[]): string {
  if (windows.length === 0) return CLOSED_SUMMARY;
  if (isAllDay(windows)) return ALL_DAY_SUMMARY;
  return windows
    .map((window) => `${window.from}${RANGE_SEPARATOR}${window.to}`)
    .join(WINDOW_SEPARATOR);
}

export function isClosedAllWeek(value: IOpeningHours): boolean {
  return QAB_OPENING_HOURS_DAYS.every((day) => value.days[day].length === 0);
}

/** `true` when the window ends the next day. `to === from` is EMPTY_WINDOW, not this. */
export function crossesMidnight(window: IOpeningHoursWindow): boolean {
  try {
    return openingHoursMinutes(window.to) < openingHoursMinutes(window.from);
  } catch {
    return false;
  }
}

/** The day of an issue, when its `path` names one. */
export function issueDay(issue: IOpeningHoursIssue): IOpeningHoursDay | null {
  const segment = issue.path[1];
  return typeof segment === "string" &&
    (QAB_OPENING_HOURS_DAYS as readonly string[]).includes(segment)
    ? (segment as IOpeningHoursDay)
    : null;
}

/** The window index of an issue, when its `path` names one. */
export function issueWindowIndex(issue: IOpeningHoursIssue): number | null {
  const segment = issue.path[2];
  return typeof segment === "number" ? segment : null;
}

/** The offending field of an issue, when its `path` names one. */
export function issueField(issue: IOpeningHoursIssue): "from" | "to" | null {
  const segment = issue.path[3];
  if (segment === "from" || segment === "to") return segment;
  return null;
}

/**
 * The last segment of a path, as PLAIN TEXT.
 *
 * For UNKNOWN_KEY and DAY_UNKNOWN this is a key the USER wrote, so it is only
 * ever rendered as a text node — never interpolated into markup and never
 * through `dangerouslySetInnerHTML` (security-guardian, F-005).
 */
function offendingKey(issue: IOpeningHoursIssue): string {
  const segment = issue.path[issue.path.length - 1];
  return String(segment ?? "");
}

/** The sentence a code with no row of its own gets. Never leaves the screen mute. */
function reserveSentence(code: IOpeningHoursIssueCode): string {
  return `El horario tiene un dato que la tienda online no acepta (${code}).`;
}

/**
 * The line of the structural block: the calendar sitting in the database cannot
 * be sent, and here is which rule it breaks.
 *
 * `allIssues` is needed to tell «one day too many» from «an unrecognised day
 * key»: both are DAY_UNKNOWN, and what separates them is whether one of the
 * seven is also missing.
 */
export function describeStructuralIssue(
  issue: IOpeningHoursIssue,
  allIssues: IOpeningHoursIssue[],
): string {
  switch (issue.code) {
    case "VERSION_INVALID":
      return `El horario guardado es de una versión que la tienda online ya no acepta (esperaba la versión ${QAB_OPENING_HOURS_VERSION}).`;
    case "DAY_MISSING": {
      const day = issueDay(issue);
      return `Al horario guardado le falta un día: ${day ? DAY_LABELS[day] : offendingKey(issue)}. La tienda online necesita los siete.`;
    }
    case "DAY_UNKNOWN": {
      const replacesAMissingDay = allIssues.some(
        (other) => other.code === "DAY_MISSING",
      );
      return replacesAMissingDay
        ? `El horario guardado usa «${offendingKey(issue)}» como día. La tienda online solo entiende mon, tue, wed, thu, fri, sat y sun.`
        : `El horario guardado trae un día de más: «${offendingKey(issue)}». La tienda online acepta exactamente siete.`;
    }
    case "UNKNOWN_KEY":
      return `El horario guardado trae un dato que la tienda online no reconoce: «${offendingKey(issue)}».`;
    case "SIZE_EXCEEDED":
      return "El horario guardado ocupa más de lo que la tienda online acepta (2 KB).";
    default:
      return reserveSentence(issue.code);
  }
}

/** Ordinals as the merchant sees them: the first window is «franja 1». */
function windowNumber(index: number | null): number {
  return (index ?? 0) + 1;
}

function windowRange(window: IOpeningHoursWindow | undefined): string {
  return window === undefined
    ? ""
    : `${window.from}${RANGE_SEPARATOR}${window.to}`;
}

/**
 * The sentence of a rule the merchant CAN break by typing, shown where it broke.
 * `windows` is the day's own list, needed to name the other window of a pair.
 */
export function describeWindowIssue(
  issue: IOpeningHoursIssue,
  windows: IOpeningHoursWindow[],
): string {
  const day = issueDay(issue);
  const dayLabel = day ? DAY_LABELS[day] : "";
  const index = issueWindowIndex(issue);
  const n = windowNumber(index);
  const window = index === null ? undefined : windows[index];

  switch (issue.code) {
    case "EMPTY_WINDOW":
      return `${dayLabel}, franja ${n}: abre y cierra a la misma hora (${window?.from ?? ""}). Cámbiala o borra la franja.`;
    case "WINDOWS_UNORDERED":
      return `${dayLabel}: las franjas van de la más temprana a la más tardía, y la ${n} abre antes que la ${n - 1}.`;
    case "WINDOWS_OVERLAP": {
      const previous = index === null ? undefined : windows[index - 1];
      return `${dayLabel}: la franja ${n} (${windowRange(window)}) se pisa con la ${n - 1} (${windowRange(previous)}). Sepáralas o júntalas en una sola.`;
    }
    case "MULTIPLE_OVERNIGHT": {
      const first = windows.findIndex(crossesMidnight);
      return `${dayLabel}: solo una franja al día puede terminar después de medianoche, y ya lo hace la ${windowNumber(first)}.`;
    }
    case "OVERNIGHT_NOT_LAST":
      return `${dayLabel}: la franja que termina después de medianoche tiene que ser la última del día. Muévela al final o cámbiale la hora de cierre.`;
    case "TIME_FORMAT_INVALID":
      return `${dayLabel}, franja ${n}: falta una hora o no está completa. Tiene que ser una hora de 24 horas, por ejemplo 09:00 o 21:30.`;
    case "TOO_MANY_WINDOWS":
      return `${dayLabel}: máximo ${QAB_OPENING_HOURS_MAX_WINDOWS_PER_DAY} franjas por día.`;
    default:
      return reserveSentence(issue.code);
  }
}

const SHORT_SENTENCES: Partial<Record<IOpeningHoursIssueCode, string>> = {
  EMPTY_WINDOW: "abre y cierra a la misma hora",
  WINDOWS_UNORDERED: "las franjas están desordenadas",
  WINDOWS_OVERLAP: "se pisa con la anterior",
  MULTIPLE_OVERNIGHT: "dos franjas cruzan la medianoche",
  OVERNIGHT_NOT_LAST: "la que cruza la medianoche no es la última",
  TIME_FORMAT_INVALID: "falta una hora",
  TOO_MANY_WINDOWS: "demasiadas franjas",
};

/** One line of the summary block: `Lunes — franja 2 se pisa con la anterior`. */
export function summarizeIssue(issue: IOpeningHoursIssue): string {
  const day = issueDay(issue);
  const dayLabel = day ? DAY_LABELS[day] : "El horario";
  const index = issueWindowIndex(issue);
  const where = index === null ? "" : `franja ${windowNumber(index)} `;
  const what = SHORT_SENTENCES[issue.code] ?? issue.code;
  return `${dayLabel} — ${where}${what}`;
}
