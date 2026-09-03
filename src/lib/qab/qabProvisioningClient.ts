import {
  QAB_PROVISIONING_REQUEST_MAX_BYTES,
  QAB_PROVISIONING_RETRYABLE_CODES,
  QAB_PROVISIONING_TIMEOUT_MS,
  QAB_PROVISIONING_UPSTREAM_CODES,
} from "@/constants/qabProvisioning";
import { readBoundedBody } from "@/lib/qab/qabHttp";
import type { IBoundedBody } from "@/lib/qab/qabHttp";
import {
  isUsableQabProvisioningSecret,
  qabProvisioningCredentialUrl,
} from "@/lib/qab/qabProvisioningEnv";
import {
  qabProvisioningAlreadyMintedResponseSchema,
  qabProvisioningMintedResponseSchema,
  qabProvisioningRequestSchema,
} from "@/schemas/qabProvisioning";

export type IQabProvisioningUpstreamCode =
  (typeof QAB_PROVISIONING_UPSTREAM_CODES)[number];

export type IQabProvisioningOutcome =
  /** 201. The ONLY place in the whole contract where the word `token` appears. */
  | { kind: "minted"; externalId: string; created: boolean; token: string }
  /** Idempotent 200: that business already had a token and this call did not touch it. */
  | { kind: "already_minted"; externalId: string }
  | { kind: "upstream_error"; code: IQabProvisioningUpstreamCode; retryable: boolean };

const [
  CODE_INVALID_BODY,
  CODE_UNAUTHORIZED,
  CODE_BUSINESS_INACTIVE,
  CODE_METHOD_NOT_ALLOWED,
  CODE_PROVISIONING_NOT_CONFIGURED,
  CODE_TOKEN_COLLISION,
  CODE_TRANSPORT,
  CODE_INVALID_RESPONSE_BODY,
  CODE_UNEXPECTED_STATUS,
  CODE_EXTERNAL_ID_MISMATCH,
] = QAB_PROVISIONING_UPSTREAM_CODES;

const RETRYABLE = new Set<IQabProvisioningUpstreamCode>(QAB_PROVISIONING_RETRYABLE_CODES);

const STATUS_MINTED = 201;
const STATUS_ALREADY_MINTED = 200;
const STATUS_INVALID_BODY = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_BUSINESS_INACTIVE = 403;
const STATUS_METHOD_NOT_ALLOWED = 405;
const STATUS_SERVICE_UNAVAILABLE = 503;

const JSON_CONTENT_TYPE = "application/json";

/** Pure. The failure outcome for one code, with its documented retryability. */
function upstreamError(code: IQabProvisioningUpstreamCode): IQabProvisioningOutcome {
  return { kind: "upstream_error", code, retryable: RETRYABLE.has(code) };
}

/** Pure. Reads the `error` field of a QAB error body, when there is one. */
function readErrorCode(bodyText: string): string | null {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed !== null && typeof parsed === "object" && "error" in parsed) {
      const value = (parsed as { error: unknown }).error;
      return typeof value === "string" ? value : null;
    }
  } catch {
    // A body that is not JSON is a body with no code. Never logged: it may be
    // arbitrary third-party content.
  }
  return null;
}

/**
 * Pure. Reads the `externalId` a success body claims to be about. `null` when it
 * is absent or is not a string - a body like that fails its schema right after
 * and comes back as INVALID_RESPONSE_BODY.
 */
function readExternalId(payload: unknown): string | null {
  if (payload !== null && typeof payload === "object" && "externalId" in payload) {
    const value = (payload as { externalId: unknown }).externalId;
    return typeof value === "string" ? value : null;
  }
  return null;
}

/**
 * PURE. Translates (status, body) into an `IQabProvisioningOutcome`. All ten
 * codes can be covered with tests and no network.
 *
 * `expectedExternalId` is NOT optional, and it is checked on BOTH bodies that
 * carry it: the 201's and the 200's. A different `externalId` yields
 * `EXTERNAL_ID_MISMATCH` whatever the status, and NEVER `minted` nor
 * `already_minted`.
 *
 * On the 201 the reason is obvious: writing into one business the token minted for
 * another is the cross-tenant leak this feature cannot afford. On the 200 it is
 * subtler and therefore worth saying: that body asserts "this business already has
 * a token", and accepting it for ANOTHER business would produce a
 * `CONFIRMED_ORPHANED` about ours based on a third party's credential - the gravest
 * diagnosis of the feature, drawn from the wrong row.
 *
 * Logs nothing. Throws nothing. Neither the body nor the token enters any message.
 */
export function mapQabProvisioningResponse(args: {
  status: number;
  bodyText: string;
  expectedExternalId: string;
}): IQabProvisioningOutcome {
  const { status, bodyText, expectedExternalId } = args;

  if (status === STATUS_MINTED || status === STATUS_ALREADY_MINTED) {
    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      return upstreamError(CODE_INVALID_RESPONSE_BODY);
    }

    // The attribution check comes BEFORE either body is mapped, not inside the
    // 201 branch: a response that is not about this business establishes nothing
    // about it, whichever status it came with.
    const responseExternalId = readExternalId(payload);
    if (responseExternalId !== null && responseExternalId !== expectedExternalId) {
      return upstreamError(CODE_EXTERNAL_ID_MISMATCH);
    }

    if (status === STATUS_MINTED) {
      const parsed = qabProvisioningMintedResponseSchema.safeParse(payload);
      if (!parsed.success) return upstreamError(CODE_INVALID_RESPONSE_BODY);
      return {
        kind: "minted",
        externalId: parsed.data.externalId,
        created: parsed.data.created,
        token: parsed.data.token,
      };
    }

    const parsed = qabProvisioningAlreadyMintedResponseSchema.safeParse(payload);
    if (!parsed.success) return upstreamError(CODE_INVALID_RESPONSE_BODY);
    return { kind: "already_minted", externalId: parsed.data.externalId };
  }

  if (status === STATUS_INVALID_BODY) return upstreamError(CODE_INVALID_BODY);
  if (status === STATUS_UNAUTHORIZED) return upstreamError(CODE_UNAUTHORIZED);
  if (status === STATUS_BUSINESS_INACTIVE) return upstreamError(CODE_BUSINESS_INACTIVE);
  if (status === STATUS_METHOD_NOT_ALLOWED) return upstreamError(CODE_METHOD_NOT_ALLOWED);

  if (status === STATUS_SERVICE_UNAVAILABLE) {
    const code = readErrorCode(bodyText);
    if (code === CODE_TOKEN_COLLISION) return upstreamError(CODE_TOKEN_COLLISION);
    if (code === CODE_PROVISIONING_NOT_CONFIGURED) {
      return upstreamError(CODE_PROVISIONING_NOT_CONFIGURED);
    }
    // Documented status, undocumented body: the response does not satisfy the
    // contract, which is exactly what INVALID_RESPONSE_BODY means.
    return upstreamError(CODE_INVALID_RESPONSE_BODY);
  }

  return upstreamError(CODE_UNEXPECTED_STATUS);
}

/**
 * Calls `POST /api/provisioning/credential`. NEVER throws and NEVER returns a
 * rejected promise: every failure comes back as `{ kind: "upstream_error" }`.
 *
 * FAIL-CLOSED (criterion 9): if `isUsableQabProvisioningSecret(secret)` is false
 * it returns PROVISIONING_NOT_CONFIGURED WITHOUT calling `fetchImpl` even once.
 * That is the check that turns criterion 9 into a unit test with a fetch spy
 * rather than only a curl.
 *
 * Validates its own body with `qabProvisioningRequestSchema` before going out;
 * if it does not satisfy it, returns INVALID_BODY without calling QAB.
 *
 * Caps the response body at QAB_HTTP_MAX_RESPONSE_BYTES and aborts at
 * QAB_PROVISIONING_TIMEOUT_MS. It logs neither the secret, nor the token, nor
 * the body.
 */
export async function mintQabBusinessCredential(args: {
  baseUrl: string;
  secret: string;
  externalId: string;
  name?: string;
  /** Injectable so the ten codes can be exercised without a network. Defaults to `fetch`. */
  fetchImpl?: typeof fetch;
}): Promise<IQabProvisioningOutcome> {
  const { baseUrl, secret, externalId, name } = args;

  if (!isUsableQabProvisioningSecret(secret)) {
    return upstreamError(CODE_PROVISIONING_NOT_CONFIGURED);
  }

  const request = qabProvisioningRequestSchema.safeParse({
    externalId,
    ...(name === undefined ? {} : { name }),
  });
  if (!request.success) return upstreamError(CODE_INVALID_BODY);

  const body = JSON.stringify(request.data);
  if (new TextEncoder().encode(body).byteLength > QAB_PROVISIONING_REQUEST_MAX_BYTES) {
    return upstreamError(CODE_INVALID_BODY);
  }

  const doFetch = args.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await doFetch(qabProvisioningCredentialUrl(baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": JSON_CONTENT_TYPE,
      },
      body,
      signal: AbortSignal.timeout(QAB_PROVISIONING_TIMEOUT_MS),
    });
  } catch {
    return upstreamError(CODE_TRANSPORT);
  }

  let bounded: IBoundedBody;
  try {
    bounded = await readBoundedBody(response);
  } catch {
    return upstreamError(CODE_TRANSPORT);
  }

  if (bounded.tooLarge) return upstreamError(CODE_INVALID_RESPONSE_BODY);

  return mapQabProvisioningResponse({
    status: response.status,
    bodyText: bounded.text,
    expectedExternalId: request.data.externalId,
  });
}
