import {
  QAB_HTTP_RESPONSE_TOO_LARGE_REASON,
  QAB_HTTP_TIMEOUT_MS,
  QAB_ORDER_MAX_BYTES,
  QAB_ORDER_PULL_RESPONSE_ENVELOPE_MAX_BYTES,
  QAB_ORDER_TYPICAL_MAX_BYTES,
  QAB_OUTBOX_ERROR_CODES,
} from "@/constants/qab";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import type { IBoundedBody } from "@/lib/qab/qabHttp";
import { qabOrdersPullUrl } from "@/lib/qab/qabEnv";
import { truncateOutboxError } from "@/lib/qab/outboxAck";
import { qabTransportErrorMessage } from "@/lib/qab/qabCatalogClient";
import { qabOrdersPageSchema } from "@/schemas/qabOrderPull";
import type { IQabOrdersPage } from "@/schemas/qabOrderPull";

export type IQabOrderFetchOutcome =
  | { kind: "ok"; page: IQabOrdersPage }
  | { kind: "error"; error: string; tooLarge: boolean };

/** The only status the contract answers a well-formed pull with. */
const QAB_OK_STATUS = 200;
const WHITESPACE_RUN = /\s+/g;

/**
 * Reason reported when the body is not JSON at all.
 *
 * A fixed string of OUR code, and NOT the runtime's parse message: V8 quotes a
 * fragment of the input in it, and the body of this route is the one that
 * carries the `Order.code`s. That the body cannot enter an error message has to
 * be structural here, not a promise not to log it.
 */
const MALFORMED_BODY_REASON = "MALFORMED_JSON";

/**
 * GETs ONE page of ONE business. Every failure it can anticipate — a transport
 * error, a timeout, an unexpected status, an oversized or unparseable body —
 * comes back as `{ kind: "error" }` instead of a rejected promise, so one
 * business cannot abort the run of the others (criterion 12).
 *
 * `tooLarge` is surfaced as its own flag and not buried in the message: it is
 * the ONLY failure the caller answers by walking down
 * QAB_ORDER_PULL_PAGE_SIZE_LADDER (ADR 0055). Shrinking the page does not fix a 401.
 *
 * The token never reaches the returned value, a log or an exception, and the
 * response body is never logged either — not whole and not truncated.
 */
export async function fetchQabOrdersPage(args: {
  baseUrl: string;
  token: string;
  since: string | null;
  limit: number;
}): Promise<IQabOrderFetchOutcome> {
  const { baseUrl, token, since, limit } = args;

  let response: Response;
  try {
    // A GET: no Content-Type and no body.
    response = await fetch(qabOrdersPullUrl(baseUrl, { since, limit }), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "error", error: qabTransportErrorMessage(error), tooLarge: false };
  }

  let body: IBoundedBody;
  try {
    // The pull's OWN cap, computed from the page it just asked for. NOT
    // QAB_HTTP_MAX_RESPONSE_BYTES, the catalog client's: a cap that does not fit
    // our own page is permanent stalling, not a recoverable error (ADR 0055, E-029).
    body = await readBoundedBody(response, qabOrderPullMaxResponseBytes(limit));
  } catch (error) {
    return { kind: "error", error: qabTransportErrorMessage(error), tooLarge: false };
  }

  if (body.tooLarge) {
    return {
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
      tooLarge: true,
    };
  }

  if (response.status !== QAB_OK_STATUS) {
    // qabOrderHttpErrorMessage, NEVER qabHttpErrorMessage: that one embeds the
    // body text, and this route's body is the one that carries `Order.code`.
    return {
      kind: "error",
      error: qabOrderHttpErrorMessage(response.status),
      tooLarge: false,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body.text);
  } catch {
    return {
      kind: "error",
      error: qabInvalidResponseBodyMessage(MALFORMED_BODY_REASON),
      tooLarge: false,
    };
  }

  const parsed = qabOrdersPageSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      kind: "error",
      error: qabInvalidResponseBodyMessage(parsed.error.issues[0]?.message ?? ""),
      tooLarge: false,
    };
  }

  return { kind: "ok", page: parsed.data };
}

/**
 * PURE. Response cap for a page of `limit` orders. COMPUTED, never chosen, and
 * with QAB_ORDER_MAX_BYTES as a FLOOR so an order that respects our own caps
 * fits even when asked for one at a time. See ADR 0055.
 */
export function qabOrderPullMaxResponseBytes(limit: number): number {
  return (
    QAB_ORDER_PULL_RESPONSE_ENVELOPE_MAX_BYTES +
    Math.max(QAB_ORDER_MAX_BYTES, limit * QAB_ORDER_TYPICAL_MAX_BYTES)
  );
}

/** PURE. `HTTP:<status>`. The response body is NEVER part of the message. */
export function qabOrderHttpErrorMessage(status: number): string {
  return `${QAB_OUTBOX_ERROR_CODES.http}:${status}`;
}

/**
 * `INVALID_RESPONSE_BODY:<first issue>`, truncated. The issue messages of these
 * schemas are fixed strings of our own code: never a value of the body.
 */
function qabInvalidResponseBodyMessage(detail: string): string {
  return truncateOutboxError(
    `${QAB_OUTBOX_ERROR_CODES.invalidResponseBody}:${detail.replace(WHITESPACE_RUN, " ").trim()}`,
  );
}
