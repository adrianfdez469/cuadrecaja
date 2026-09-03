import { API_AUTH_ALLOWLIST, API_PATH_PREFIX } from "@/constants/apiAuth";

/**
 * Pure path logic of the API authentication gate (F-018, ADR 0017).
 *
 * No import from `next/*` on purpose: every decision here is a string
 * transformation, so it can be covered without Next, a database or HTTP.
 */

/** Percent-decoding is best effort and bounded; see toLoosePath(). */
const MAX_PERCENT_DECODE_PASSES = 3;

const PATH_SEPARATOR = "/";
const CURRENT_SEGMENT = ".";
const PARENT_SEGMENT = "..";

/**
 * Structural normalisation only: collapses repeated slashes, resolves "." and
 * ".." segments, trims trailing slashes (except at the root).
 * Neither percent-decodes nor changes case: this is the form the ALLOWLIST is
 * compared against, and it must allow as little as possible.
 */
export function toStrictPath(pathname: string): string {
  if (typeof pathname !== "string" || !pathname.startsWith(PATH_SEPARATOR)) {
    // Total by design: anything that is not an absolute path is not an API
    // path, so it normalises to the root and never reaches the allowlist.
    return PATH_SEPARATOR;
  }

  const resolved: string[] = [];

  for (const segment of pathname.split(PATH_SEPARATOR)) {
    // An empty segment is either a repeated or a trailing slash.
    if (segment === "" || segment === CURRENT_SEGMENT) continue;
    if (segment === PARENT_SEGMENT) {
      // pop() on an empty stack is a no-op: ".." never climbs above the root.
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.length === 0
    ? PATH_SEPARATOR
    : `${PATH_SEPARATOR}${resolved.join(PATH_SEPARATOR)}`;
}

/**
 * Percent-decodes up to MAX_PERCENT_DECODE_PASSES times, keeping the last
 * successfully decoded string. decodeURIComponent throws on malformed input
 * (an over-long UTF-8 sequence such as "%c0%af", or "%zz"), and this function
 * must never throw outwards: an undecidable path stays as it is and is then
 * gated, which is the safe verdict.
 */
function decodePercentEncodingBestEffort(value: string): string {
  let current = value;

  for (let pass = 0; pass < MAX_PERCENT_DECODE_PASSES; pass += 1) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return current;
    }
    if (decoded === current) return current;
    current = decoded;
  }

  return current;
}

/**
 * toStrictPath() applied after best-effort percent-decoding (at most 3 passes,
 * stopping if decodeURIComponent throws), then lowercased.
 * This is the form used to decide whether the request targets the API at all,
 * and it must catch as much as possible.
 */
export function toLoosePath(pathname: string): string {
  if (typeof pathname !== "string") return PATH_SEPARATOR;
  return toStrictPath(decodePercentEncodingBestEffort(pathname)).toLowerCase();
}

/** `path === entry || path.startsWith(entry + "/")`. Never a raw prefix test. */
export function matchesPathSegment(path: string, entry: string): boolean {
  return path === entry || path.startsWith(`${entry}${PATH_SEPARATOR}`);
}

/** True when the loose form is "/api" or lives under "/api/". */
export function isApiPath(pathname: string): boolean {
  return matchesPathSegment(toLoosePath(pathname), API_PATH_PREFIX);
}

/** True when the strict form matches an API_AUTH_ALLOWLIST entry by segment. */
export function isAllowlistedApiPath(pathname: string): boolean {
  const strictPath = toStrictPath(pathname);
  return API_AUTH_ALLOWLIST.some((entry) =>
    matchesPathSegment(strictPath, entry),
  );
}

/** isApiPath(pathname) && !isAllowlistedApiPath(pathname). The gate's verdict. */
export function requiresApiAuth(pathname: string): boolean {
  return isApiPath(pathname) && !isAllowlistedApiPath(pathname);
}
