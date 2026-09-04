import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_SLUG_AVAILABILITY_PATH,
  QAB_SLUG_RETRYABLE_CODES,
  QAB_SLUG_UPSTREAM_CODES,
} from "@/constants/qab";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import { tiendaOnlineSlugForecastSchema } from "@/schemas/tiendaOnline";
import type { ITiendaOnlineSlugForecast } from "@/schemas/tiendaOnline";

export type IQabSlugUpstreamCode = (typeof QAB_SLUG_UPSTREAM_CODES)[number];

export type IQabSlugQuery = { slug?: string; name?: string; storeId?: string };

export type IQabSlugOutcome =
  | { kind: "ok"; forecast: ITiendaOnlineSlugForecast }
  | { kind: "error"; code: IQabSlugUpstreamCode };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVICE_UNAVAILABLE = 503;

const SLUG_PARAM = "slug";
const NAME_PARAM = "name";
const STORE_ID_PARAM = "storeId";

/** PURE. baseUrl + QAB_SLUG_AVAILABILITY_PATH + the encoded query. */
export function qabSlugAvailabilityUrl(
  baseUrl: string,
  query: IQabSlugQuery,
): string {
  const params = new URLSearchParams();
  if (query.slug !== undefined) params.set(SLUG_PARAM, query.slug);
  if (query.name !== undefined) params.set(NAME_PARAM, query.name);
  if (query.storeId !== undefined) params.set(STORE_ID_PARAM, query.storeId);

  const search = params.toString();
  const suffix = search.length > 0 ? `?${search}` : "";
  return `${baseUrl}${QAB_SLUG_AVAILABILITY_PATH}${suffix}`;
}

/** PURE. */
export function isRetryableSlugCode(code: IQabSlugUpstreamCode): boolean {
  return (QAB_SLUG_RETRYABLE_CODES as readonly string[]).includes(code);
}

/** The statuses the contract documents, and the code each one becomes. */
function codeForStatus(status: number): IQabSlugUpstreamCode {
  if (status === HTTP_BAD_REQUEST) return "MISSING_QUERY";
  if (status === HTTP_UNAUTHORIZED) return "UNAUTHORIZED";
  if (status === HTTP_FORBIDDEN) return "BUSINESS_INACTIVE";
  if (status === HTTP_SERVICE_UNAVAILABLE) return "SYNC_NOT_CONFIGURED";
  return "UNEXPECTED_STATUS";
}

/**
 * NEVER throws: every failure comes back as `{ kind: "error" }`. Reuses
 * `readBoundedBody` and AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS). Logs nothing:
 * not the token, not the URL, not the response body.
 */
export async function fetchQabSlugAvailability(args: {
  baseUrl: string;
  token: string;
  query: IQabSlugQuery;
}): Promise<IQabSlugOutcome> {
  const { baseUrl, token, query } = args;

  let response: Response;
  try {
    response = await fetch(qabSlugAvailabilityUrl(baseUrl, query), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch {
    return { kind: "error", code: "TRANSPORT" };
  }

  if (response.status !== HTTP_OK) {
    // The body is not read for a non-200: nothing in it is used, and reading it
    // only widens what a third party can push into this process.
    await response.body?.cancel();
    return { kind: "error", code: codeForStatus(response.status) };
  }

  let text: string;
  try {
    const body = await readBoundedBody(response);
    if (body.tooLarge) return { kind: "error", code: "TRANSPORT" };
    text = body.text;
  } catch {
    return { kind: "error", code: "TRANSPORT" };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: "error", code: "INVALID_RESPONSE_BODY" };
  }

  // The forecast schema is `.strict()`, so QAB's `reserving` — always false by
  // contract — is dropped here and never re-exposed (ADR 0033). `reserving` is
  // picked off explicitly instead of failing the parse for an extra key.
  const parsed = tiendaOnlineSlugForecastSchema.safeParse(
    stripUnknownKeys(json),
  );
  if (!parsed.success) return { kind: "error", code: "INVALID_RESPONSE_BODY" };

  return { kind: "ok", forecast: parsed.data };
}

const FORECAST_KEYS = [
  "candidate",
  "available",
  "reason",
  "resolvedSlug",
  "url",
  "storeKnown",
] as const;

/** Keeps only the six keys the screen is given. Anything else is discarded. */
function stripUnknownKeys(json: unknown): unknown {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return json;
  }
  const source = json as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const key of FORECAST_KEYS) {
    if (key in source) kept[key] = source[key];
  }
  return kept;
}
