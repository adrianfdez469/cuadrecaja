import { QAB_HTTP_MAX_RESPONSE_BYTES } from "@/constants/qab";

const CONTENT_LENGTH_HEADER = "content-length";

export interface IBoundedBody {
  /** `true` when the response exceeded the caller's byte cap and was cut short. */
  tooLarge: boolean;
  text: string;
}

/**
 * Reads at most `maxBytes` of the response body. Nothing forces QAB - or
 * whatever a mispointed QAB_API_BASE_URL resolves to - to answer with a bounded
 * body, and a serverless function must not materialise it whole.
 *
 * `maxBytes` defaults to QAB_HTTP_MAX_RESPONSE_BYTES, so the catalog and
 * provisioning clients keep the behaviour they have; the availability client
 * passes its own, larger cap, computed from its page size (ADR 0051). The cap
 * belongs to each client, not to this function: baking one number into a helper
 * shared by three clients with three different responses was the mechanism of
 * that defect.
 *
 * Shared by the QAB clients (`qabCatalogClient`, `qabProvisioningClient`,
 * `qabAvailabilityClient`). It is the ONLY thing they share: a pure bounded
 * read, with no credential and no error vocabulary of its own. See ADR 0026.
 */
export async function readBoundedBody(
  response: Response,
  maxBytes: number = QAB_HTTP_MAX_RESPONSE_BYTES,
): Promise<IBoundedBody> {
  const declaredLength = Number(response.headers.get(CONTENT_LENGTH_HEADER));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
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
    if (bytes > maxBytes) {
      await reader.cancel();
      return { tooLarge: true, text: "" };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  return { tooLarge: false, text };
}
