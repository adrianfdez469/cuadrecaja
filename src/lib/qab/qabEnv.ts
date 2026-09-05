import { QAB_AVAILABILITY_SYNC_PATH, QAB_CATALOG_SYNC_PATH } from "@/constants/qab";

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
