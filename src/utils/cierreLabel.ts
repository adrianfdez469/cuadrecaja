import dayjs from "dayjs";
import { CIERRE_ETIQUETA_MAX_LENGTH } from "@/constants/cierre";

/** How a period's dates read everywhere in the app. */
const DATE_FORMAT = "DD/MM/YYYY";

/** Stands in for the end of a period that has not been closed yet. */
export const CIERRE_OPEN_END_LABEL = "Actual";

type DateLike = Date | string | null | undefined;

export interface CierreLabelSource {
  /** The operator's own name for the period. NULL/empty means "unnamed". */
  etiqueta?: string | null;
  /** Optional because `ICierreData` declares it so; missing dates just fall
   *  back to the open-period wording rather than throwing. */
  fechaInicio?: DateLike;
  fechaFin?: DateLike;
}

/**
 * The date range of a period, as it has always been shown: `"05/09/2026 -
 * 05/09/2026"`, or `"05/09/2026 - Actual"` while the period is still open.
 *
 * This is the fallback label AND the value the editor is pre-filled with, so
 * naming a period starts from what the user was already reading on screen.
 */
export function buildCierreDateRangeLabel(
  fechaInicio: DateLike,
  fechaFin?: DateLike,
): string {
  const inicio = fechaInicio ? dayjs(fechaInicio).format(DATE_FORMAT) : "";
  const fin = fechaFin ? dayjs(fechaFin).format(DATE_FORMAT) : CIERRE_OPEN_END_LABEL;
  return inicio ? `${inicio} - ${fin}` : fin;
}

/**
 * What a period is called on screen: its own label when it has one, its date
 * range otherwise. Every list, detail and export goes through here so a period
 * cannot end up named one way in one place and another way somewhere else.
 */
export function resolveCierreLabel({
  etiqueta,
  fechaInicio,
  fechaFin,
}: CierreLabelSource): string {
  const propio = etiqueta?.trim();
  return propio || buildCierreDateRangeLabel(fechaInicio, fechaFin);
}

/** True when the period carries a label of its own rather than its dates. */
export function hasCierreEtiqueta(etiqueta?: string | null): boolean {
  return Boolean(etiqueta?.trim());
}

/**
 * The label as it gets stored: trimmed, with runs of whitespace collapsed, cut
 * to the maximum length, and `null` when nothing is left — clearing the field
 * is how the operator goes back to the date range.
 *
 * Runs through the same function on the client and in the route handler, so
 * what the form validates is what the database receives.
 */
export function normalizeCierreEtiqueta(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  const limpia = raw.replace(/\s+/g, " ").trim();
  if (!limpia) return null;
  return limpia.slice(0, CIERRE_ETIQUETA_MAX_LENGTH).trim();
}

/**
 * The period's name, made safe to sit inside a downloaded file name.
 *
 * Exports used to be stamped with `new Date()`, so three periods exported the
 * same afternoon produced three files with the same name and the browser was
 * left to disambiguate them with `(1)`, `(2)`. Naming them after the period
 * itself is the same fix as naming the rows.
 */
export function buildCierreFileNameSlug(source: CierreLabelSource): string {
  return (
    resolveCierreLabel(source)
      // Dates carry slashes, which no file name may hold.
      .replace(/[/\\]/g, "-")
      // Letters and digits of any alphabet survive; punctuation does not.
      .replace(/[^\p{L}\p{N} _-]/gu, "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/^[_-]+|[_-]+$/g, "")
      .slice(0, CIERRE_ETIQUETA_MAX_LENGTH) || "cierre"
  );
}
