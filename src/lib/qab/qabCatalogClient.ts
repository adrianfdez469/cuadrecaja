import {
  QAB_HTTP_MAX_RESPONSE_BYTES,
  QAB_HTTP_RESPONSE_TOO_LARGE_REASON,
  QAB_HTTP_TIMEOUT_MS,
  QAB_OUTBOX_ERROR_CODES,
} from "@/constants/qab";
import { qabCatalogSyncUrl } from "@/lib/qab/qabEnv";
import { truncateOutboxError } from "@/lib/qab/outboxAck";
import { qabCatalogSyncResponseSchema } from "@/schemas/qabSync";
import type { IQabCatalogBatch, IQabCatalogSyncResponse } from "@/schemas/qabSync";

export type IQabPostOutcome =
  | { kind: "ok"; response: IQabCatalogSyncResponse }
  | { kind: "error"; ultimoError: string };

/** The only status the contract answers a well-formed batch with. */
const QAB_MULTI_STATUS = 207;
const CONTENT_LENGTH_HEADER = "content-length";
const WHITESPACE_RUN = /\s+/g;

interface IBoundedBody {
  /** `true` when the response exceeded QAB_HTTP_MAX_RESPONSE_BYTES and was cut short. */
  tooLarge: boolean;
  text: string;
}

/**
 * Reads at most QAB_HTTP_MAX_RESPONSE_BYTES of the response body. Nothing forces
 * QAB — or whatever a mispointed QAB_API_BASE_URL resolves to — to answer with a
 * bounded body, and a serverless function must not materialise it whole.
 */
async function readBoundedBody(response: Response): Promise<IBoundedBody> {
  const declaredLength = Number(response.headers.get(CONTENT_LENGTH_HEADER));
  if (Number.isFinite(declaredLength) && declaredLength > QAB_HTTP_MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    return { tooLarge: true, text: "" };
  }

  const reader = response.body?.getReader();
  if (!reader) return { tooLarge: false, text: "" };

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > QAB_HTTP_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return { tooLarge: true, text: "" };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  return { tooLarge: false, text };
}

/**
 * POSTs one business's batch. NEVER throws and NEVER returns a rejected promise:
 * every failure comes back as `{ kind: "error" }` so one business cannot abort
 * the run of the others.
 *
 * Nothing here logs the token, the raw fetch error, or the response body: see
 * the logging rule of the F-002 interface contract.
 */
export async function postQabCatalogBatch(args: {
  baseUrl: string;
  token: string;
  batch: IQabCatalogBatch;
}): Promise<IQabPostOutcome> {
  const { baseUrl, token, batch } = args;

  let response: Response;
  try {
    response = await fetch(qabCatalogSyncUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch (error) {
    return { kind: "error", ultimoError: qabTransportErrorMessage(error) };
  }

  let body: IBoundedBody;
  try {
    body = await readBoundedBody(response);
  } catch (error) {
    return { kind: "error", ultimoError: qabTransportErrorMessage(error) };
  }

  if (body.tooLarge) {
    return {
      kind: "error",
      ultimoError: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
    };
  }

  if (response.status !== QAB_MULTI_STATUS) {
    return { kind: "error", ultimoError: qabHttpErrorMessage(response.status, body.text) };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(body.text);
  } catch (error) {
    return { kind: "error", ultimoError: qabInvalidResponseBodyMessage(error) };
  }

  const parsed = qabCatalogSyncResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      kind: "error",
      ultimoError: qabInvalidResponseBodyMessage(parsed.error.issues[0]?.message ?? ""),
    };
  }

  return { kind: "ok", response: parsed.data };
}

/** Pure. `HTTP:<status>:<body, whitespace collapsed>`, truncated. */
export function qabHttpErrorMessage(status: number, body: string): string {
  const collapsed = body.replace(WHITESPACE_RUN, " ").trim();
  return truncateOutboxError(`${QAB_OUTBOX_ERROR_CODES.http}:${status}:${collapsed}`);
}

/** Pure. `TRANSPORT:<message>`, truncated. */
export function qabTransportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return truncateOutboxError(`${QAB_OUTBOX_ERROR_CODES.transport}:${message}`);
}

/** `INVALID_RESPONSE_BODY:<first issue>`, truncated. */
function qabInvalidResponseBodyMessage(detail: unknown): string {
  const message = detail instanceof Error ? detail.message : String(detail);
  return truncateOutboxError(
    `${QAB_OUTBOX_ERROR_CODES.invalidResponseBody}:${message.replace(WHITESPACE_RUN, " ").trim()}`,
  );
}
