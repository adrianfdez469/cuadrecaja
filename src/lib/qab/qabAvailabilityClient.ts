import {
  QAB_AVAILABILITY_MAX_RESPONSE_BYTES,
  QAB_HTTP_RESPONSE_TOO_LARGE_REASON,
  QAB_HTTP_TIMEOUT_MS,
  QAB_OUTBOX_ERROR_CODES,
} from "@/constants/qab";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import type { IBoundedBody } from "@/lib/qab/qabHttp";
import { qabAvailabilitySyncUrl } from "@/lib/qab/qabEnv";
import { truncateOutboxError } from "@/lib/qab/outboxAck";
import {
  qabHttpErrorMessage,
  qabTransportErrorMessage,
} from "@/lib/qab/qabCatalogClient";
import { qabAvailabilitySyncResponseSchema } from "@/schemas/qabAvailability";
import type {
  IQabAvailabilityBatch,
  IQabAvailabilitySyncResponse,
} from "@/schemas/qabAvailability";

export type IQabAvailabilityPostOutcome =
  | { kind: "ok"; response: IQabAvailabilitySyncResponse }
  | { kind: "error"; error: string };

/** The only status the contract answers a well-formed availability batch with. */
const QAB_OK_STATUS = 200;
const WHITESPACE_RUN = /\s+/g;

/**
 * POSTs one page of one business. Every failure it can anticipate — a transport
 * error, a timeout, an unexpected status, an oversized or unparseable body —
 * comes back as `{ kind: "error" }` instead of a rejected promise, so one
 * business cannot abort the run of the others (criterion 11). Same shape as
 * `postQabCatalogBatch`.
 *
 * The token never reaches the returned value, a log or an exception, and the
 * response body is never logged either — not whole and not truncated: it is a
 * third party's unverified content (logging rule of the F-002 contract).
 */
export async function postQabAvailabilityBatch(args: {
  baseUrl: string;
  token: string;
  batch: IQabAvailabilityBatch;
}): Promise<IQabAvailabilityPostOutcome> {
  const { baseUrl, token, batch } = args;

  let response: Response;
  try {
    response = await fetch(qabAvailabilitySyncUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "error", error: qabTransportErrorMessage(error) };
  }

  let body: IBoundedBody;
  try {
    // Availability's own cap, computed from the page it just sent: with the
    // F-002 cap a page confirmed above ~1250 items is always rejected and the
    // business stalls forever, because the run order is deterministic. ADR 0051.
    body = await readBoundedBody(response, QAB_AVAILABILITY_MAX_RESPONSE_BYTES);
  } catch (error) {
    return { kind: "error", error: qabTransportErrorMessage(error) };
  }

  if (body.tooLarge) {
    return {
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
    };
  }

  if (response.status !== QAB_OK_STATUS) {
    return { kind: "error", error: qabHttpErrorMessage(response.status, body.text) };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body.text);
  } catch (error) {
    return { kind: "error", error: qabInvalidResponseBodyMessage(error) };
  }

  const parsed = qabAvailabilitySyncResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      kind: "error",
      error: qabInvalidResponseBodyMessage(parsed.error.issues[0]?.message ?? ""),
    };
  }

  return { kind: "ok", response: parsed.data };
}

/** `INVALID_RESPONSE_BODY:<first issue>`, truncated. */
function qabInvalidResponseBodyMessage(detail: unknown): string {
  const message = detail instanceof Error ? detail.message : String(detail);
  return truncateOutboxError(
    `${QAB_OUTBOX_ERROR_CODES.invalidResponseBody}:${message.replace(WHITESPACE_RUN, " ").trim()}`,
  );
}
