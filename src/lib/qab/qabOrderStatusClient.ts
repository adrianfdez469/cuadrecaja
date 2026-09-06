import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_ORDER_STATUS_FAILURE_CODES,
  QAB_ORDER_STATUS_MAX_RESPONSE_BYTES,
  QAB_ORDER_STATUS_REPORTABLE,
  QAB_ORDER_STATUS_RETRYABLE_CODES,
} from "@/constants/qab";
import { qabOrderStatusUrl } from "@/lib/qab/qabEnv";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import { qabOrderStatusResponseSchema } from "@/schemas/qabOrderStatus";

export type IQabOrderStatusReportable =
  (typeof QAB_ORDER_STATUS_REPORTABLE)[number];
export type IQabOrderStatusFailureCode =
  (typeof QAB_ORDER_STATUS_FAILURE_CODES)[number];

/**
 * The outcome of ONE report. It has NO free-text field, on purpose: there is no
 * `string` in this type where a fragment of the other side's body could end up
 * (E-031). That is the deliberate difference with `fetchQabOrdersPage`, which
 * returns `error: string` because it has to write `OutboxEvento.ultimoError`.
 */
export type IQabOrderStatusOutcome =
  | { kind: "ok" }
  | { kind: "error"; code: IQabOrderStatusFailureCode };

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_SERVICE_UNAVAILABLE = 503;

/**
 * PURE. The failure code of an HTTP status this route answered. Total over every
 * number; anything the table of ADR 0064 § 2 does not name is UNEXPECTED_STATUS.
 *
 * 200 is not a failure and this function is never called with it; if it is, it
 * answers UNEXPECTED_STATUS like any other unnamed number, because a partial
 * function here would need a branch nobody exercises.
 */
export function qabOrderStatusFailureCode(
  httpStatus: number,
): IQabOrderStatusFailureCode {
  if (httpStatus === HTTP_BAD_REQUEST) return "INVALID_BODY";
  if (httpStatus === HTTP_UNAUTHORIZED) return "UNAUTHORIZED";
  if (httpStatus === HTTP_FORBIDDEN) return "BUSINESS_INACTIVE";
  if (httpStatus === HTTP_NOT_FOUND) return "UNKNOWN_ORDER";
  if (httpStatus === HTTP_CONFLICT) return "ORDER_DELIVERY_NOT_QUOTED";
  if (httpStatus === HTTP_SERVICE_UNAVAILABLE) return "SYNC_NOT_CONFIGURED";
  return "UNEXPECTED_STATUS";
}

/**
 * PURE. Whether a person may usefully be offered the button again. Reads
 * QAB_ORDER_STATUS_RETRYABLE_CODES and decides nothing of its own: the same
 * question answered in two places drifts (E-014).
 */
export function isQabOrderStatusRetryable(
  code: IQabOrderStatusFailureCode,
): boolean {
  return (QAB_ORDER_STATUS_RETRYABLE_CODES as readonly string[]).includes(code);
}

/**
 * POSTs one status report for ONE order of ONE business.
 *
 * Issues EXACTLY ONE `fetch` and contains no loop: this function never retries,
 * and neither does its caller. Acceptance criterion 4 rests on that plus the
 * three other mechanisms listed in ADR 0064 § 4.
 *
 * On a status OTHER than 200 the error body is CANCELLED without being read:
 * never parsed, never logged. The outcome comes from the status alone.
 *
 * On 200 the body is read with its own cap and has to satisfy
 * `qabOrderStatusResponseSchema`; anything else is INVALID_RESPONSE_BODY. The
 * `JSON.parse` runs inside a `catch` that binds nothing: V8 quotes a fragment of
 * the input in that message.
 *
 * The token never reaches the returned value, a log or an exception. Neither
 * does the order id: the outcome carries a code and nothing else.
 */
export async function postQabOrderStatus(args: {
  baseUrl: string;
  token: string;
  /** `PedidoEntrante.qabOrderId`, decimal digits. Travels as `orderId`. */
  qabOrderId: string;
  status: IQabOrderStatusReportable;
}): Promise<IQabOrderStatusOutcome> {
  const { baseUrl, token, qabOrderId, status } = args;

  let response: Response;
  try {
    response = await fetch(qabOrderStatusUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      // No `reason`: the contract makes it optional and nothing captures one.
      body: JSON.stringify({ orderId: qabOrderId, status }),
      signal: AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS),
    });
  } catch {
    return { kind: "error", code: "TRANSPORT" };
  }

  if (response.status !== HTTP_OK) {
    await response.body?.cancel();
    return { kind: "error", code: qabOrderStatusFailureCode(response.status) };
  }

  let text: string;
  try {
    const body = await readBoundedBody(
      response,
      QAB_ORDER_STATUS_MAX_RESPONSE_BYTES,
    );
    if (body.tooLarge) return { kind: "error", code: "INVALID_RESPONSE_BODY" };
    text = body.text;
  } catch {
    return { kind: "error", code: "INVALID_RESPONSE_BODY" };
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: "error", code: "INVALID_RESPONSE_BODY" };
  }

  if (!qabOrderStatusResponseSchema.safeParse(json).success) {
    return { kind: "error", code: "INVALID_RESPONSE_BODY" };
  }

  return { kind: "ok" };
}
