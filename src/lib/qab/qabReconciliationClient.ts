import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_RECONCILIATION_MAX_RESPONSE_BYTES,
  QAB_RECONCILIATION_PATH,
  QAB_RECONCILIATION_STORE_ID_PARAM,
  QAB_RECONCILIATION_UNKNOWN_STORE_ERROR,
} from "@/constants/qab";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import type { IBoundedBody } from "@/lib/qab/qabHttp";
import { qabCatalogHashSchema } from "@/schemas/qabReconciliation";
import type {
  IQabCatalogHash,
  IQabReconciliationUpstreamCode,
} from "@/schemas/qabReconciliation";

export type IQabReconciliationOutcome =
  | { kind: "ok"; response: IQabCatalogHash }
  | { kind: "error"; code: IQabReconciliationUpstreamCode };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVICE_UNAVAILABLE = 503;
const ERROR_KEY = "error";

/** PURE. `baseUrl` + QAB_RECONCILIATION_PATH + `?storeId=` via URLSearchParams. */
export function qabReconciliationUrl(
  baseUrl: string,
  params: { storeId: string },
): string {
  const query = new URLSearchParams();
  query.set(QAB_RECONCILIATION_STORE_ID_PARAM, params.storeId);
  return `${baseUrl}${QAB_RECONCILIATION_PATH}?${query.toString()}`;
}

function errorOutcome(code: IQabReconciliationUpstreamCode): IQabReconciliationOutcome {
  return { kind: "error", code };
}

/** The documented 404 body, and nothing else, recognised without a message. */
function isUnknownStoreBody(parsed: unknown): boolean {
  if (typeof parsed !== "object" || parsed === null) return false;
  const value = (parsed as Record<string, unknown>)[ERROR_KEY];
  return value === QAB_RECONCILIATION_UNKNOWN_STORE_ERROR;
}

/**
 * GETs § ⑤ for ONE store.
 *
 * The eight failures it anticipates — the members of
 * QAB_RECONCILIATION_UPSTREAM_CODES — come back as `{ kind: "error", code }`
 * instead of a rejected promise, so one store cannot abort the run of the
 * others. It is not a claim that nothing can ever throw: the per-store
 * `try/catch` of `runQabReconciliationCron` (§ 4.5) is what makes criterion 4's
 * "the run of the other stores is not interrupted" true, and it stays there.
 *
 * Status mapping, exhaustive:
 *   200 + a body satisfying `qabCatalogHashSchema`  -> { kind: "ok" }
 *   200 + oversized, unparseable or invalid body    -> INVALID_RESPONSE_BODY
 *   400 -> MISSING_STORE_ID   401 -> UNAUTHORIZED   403 -> BUSINESS_INACTIVE
 *   503 -> SYNC_NOT_CONFIGURED
 *   404 + body `{"error":"UNKNOWN_STORE"}`          -> UNKNOWN_STORE
 *   404 + any other body                            -> UNEXPECTED_STATUS
 *   any other status                                -> UNEXPECTED_STATUS
 *   no HTTP response, timeout, failed body read     -> TRANSPORT
 *
 * The 404 body IS read, bounded by QAB_RECONCILIATION_MAX_RESPONSE_BYTES,
 * unlike `fetchQabSlugAvailability`, which cancels every non-200. The reason is
 * specific: UNKNOWN_STORE is the one error code this run treats as PROOF that
 * QAB answered, and a mispointed QAB_API_BASE_URL that 404s on an unknown path
 * would otherwise be read as a healthy sync for ever.
 *
 * Reuses `readBoundedBody` (`src/lib/qab/qabHttp.ts`) and
 * `AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)`. Logs nothing at all: not the
 * credential, not the URL, not the response body, not the hash.
 */
export async function fetchQabReconciliation(args: {
  baseUrl: string;
  token: string;
  storeId: string;
}): Promise<IQabReconciliationOutcome> {
  const { baseUrl, token, storeId } = args;

  let response: Response;
  try {
    response = await fetch(qabReconciliationUrl(baseUrl, { storeId }), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch {
    // The thrown value is dropped, not logged and not carried: a runtime error
    // message quotes what broke it, and here that could be the URL or the
    // header (E-031). The vocabulary is closed and a code is enough.
    return errorOutcome("TRANSPORT");
  }

  const { status } = response;

  if (status !== HTTP_OK && status !== HTTP_NOT_FOUND) {
    await response.body?.cancel();
    if (status === HTTP_BAD_REQUEST) return errorOutcome("MISSING_STORE_ID");
    if (status === HTTP_UNAUTHORIZED) return errorOutcome("UNAUTHORIZED");
    if (status === HTTP_FORBIDDEN) return errorOutcome("BUSINESS_INACTIVE");
    if (status === HTTP_SERVICE_UNAVAILABLE) return errorOutcome("SYNC_NOT_CONFIGURED");
    return errorOutcome("UNEXPECTED_STATUS");
  }

  let body: IBoundedBody;
  try {
    body = await readBoundedBody(response, QAB_RECONCILIATION_MAX_RESPONSE_BYTES);
  } catch {
    return errorOutcome("TRANSPORT");
  }

  // A body over the cap is not the documented one either way. Which code that
  // is depends on the status, so the two statuses do not share a branch.
  const malformed: IQabReconciliationUpstreamCode =
    status === HTTP_OK ? "INVALID_RESPONSE_BODY" : "UNEXPECTED_STATUS";

  if (body.tooLarge) return errorOutcome(malformed);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body.text);
  } catch {
    return errorOutcome(malformed);
  }

  if (status === HTTP_NOT_FOUND) {
    return errorOutcome(isUnknownStoreBody(parsedJson) ? "UNKNOWN_STORE" : "UNEXPECTED_STATUS");
  }

  const parsed = qabCatalogHashSchema.safeParse(parsedJson);
  if (!parsed.success) return errorOutcome("INVALID_RESPONSE_BODY");

  return { kind: "ok", response: parsed.data };
}
