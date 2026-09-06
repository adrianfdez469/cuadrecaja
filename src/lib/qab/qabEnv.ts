import {
  QAB_AVAILABILITY_SYNC_PATH,
  QAB_CATALOG_SYNC_PATH,
  QAB_ORDERS_PULL_PATH,
  QAB_ORDER_STATUS_PATH,
} from "@/constants/qab";

/** Thrown when QAB_API_BASE_URL is present but is not an absolute http(s) origin. */
export class QabConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QabConfigError";
  }
}

const HTTP_PROTOCOL = "http:";
const HTTPS_PROTOCOL = "https:";
const PRODUCTION_NODE_ENV = "production";
const ROOT_PATHNAME = "/";
const TRAILING_SLASHES = /\/+$/;
const SINCE_PARAM = "since";
const LIMIT_PARAM = "limit";

/**
 * The QAB origin, without a trailing slash, or `null` when the variable is unset
 * or blank. Pure: takes the environment as an argument so it can be tested.
 * Throws `QabConfigError` when the value is present but malformed.
 *
 * "Malformed" means: it does not parse as a `URL`; its protocol is neither
 * `http:` nor `https:`; its protocol is `http:` while NODE_ENV is production
 * (the per-business qabToken travels in the Authorization header of every POST,
 * and serving it in the clear is not acceptable in production); or it carries a
 * path, query, hash or userinfo — only a bare origin is accepted.
 */
export function resolveQabBaseUrl(env?: NodeJS.ProcessEnv): string | null {
  const source = env ?? process.env;
  const raw = source.QAB_API_BASE_URL;
  if (raw === undefined) return null;

  const trimmed = raw.trim().replace(TRAILING_SLASHES, "");
  if (trimmed.length === 0) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new QabConfigError("QAB_API_BASE_URL is not a valid URL");
  }

  if (url.protocol !== HTTP_PROTOCOL && url.protocol !== HTTPS_PROTOCOL) {
    throw new QabConfigError("QAB_API_BASE_URL must use http or https");
  }

  if (url.protocol === HTTP_PROTOCOL && source.NODE_ENV === PRODUCTION_NODE_ENV) {
    throw new QabConfigError("QAB_API_BASE_URL must use https in production");
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new QabConfigError("QAB_API_BASE_URL must not carry credentials");
  }

  if (url.pathname !== ROOT_PATHNAME || url.search.length > 0 || url.hash.length > 0) {
    throw new QabConfigError("QAB_API_BASE_URL must be a bare origin");
  }

  return `${url.protocol}//${url.host}`;
}

/** Pure. `resolveQabBaseUrl` output + QAB_CATALOG_SYNC_PATH. */
export function qabCatalogSyncUrl(baseUrl: string): string {
  return `${baseUrl}${QAB_CATALOG_SYNC_PATH}`;
}

/** Pure. `resolveQabBaseUrl` output + QAB_AVAILABILITY_SYNC_PATH. */
export function qabAvailabilitySyncUrl(baseUrl: string): string {
  return `${baseUrl}${QAB_AVAILABILITY_SYNC_PATH}`;
}

/**
 * Pure. `resolveQabBaseUrl` output + QAB_ORDERS_PULL_PATH + the incremental
 * pull's query. `since` is omitted entirely when the business has no cursor yet.
 * Values go through URLSearchParams: nothing is concatenated by hand.
 *
 * Never `since=` empty and never `since=null`: the contract answers 500 to a
 * `since` out of range and does not document the empty one.
 */
export function qabOrdersPullUrl(
  baseUrl: string,
  params: { since: string | null; limit: number },
): string {
  const query = new URLSearchParams();
  if (params.since !== null && params.since.length > 0) {
    query.set(SINCE_PARAM, params.since);
  }
  query.set(LIMIT_PARAM, String(params.limit));
  return `${baseUrl}${QAB_ORDERS_PULL_PATH}?${query.toString()}`;
}

/** Pure. `resolveQabBaseUrl` output + QAB_ORDER_STATUS_PATH. No query. */
export function qabOrderStatusUrl(baseUrl: string): string {
  return `${baseUrl}${QAB_ORDER_STATUS_PATH}`;
}
