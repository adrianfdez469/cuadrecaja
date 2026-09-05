import { describe, it, expect, vi, afterEach } from "vitest";
import { postQabAvailabilityBatch } from "@/lib/qab/qabAvailabilityClient";
import { qabHttpErrorMessage, qabTransportErrorMessage } from "@/lib/qab/qabCatalogClient";
import { qabAvailabilitySyncUrl } from "@/lib/qab/qabEnv";
import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_HTTP_MAX_RESPONSE_BYTES,
  QAB_AVAILABILITY_BATCH_SIZE,
  QAB_AVAILABILITY_MAX_RESPONSE_BYTES,
  QAB_OUTBOX_ERROR_CODES,
  QAB_HTTP_RESPONSE_TOO_LARGE_REASON,
} from "@/constants/qab";
import type { IQabAvailabilityBatch } from "@/schemas/qabAvailability";

/**
 * F-007 — `src/lib/qab/qabAvailabilityClient.ts`. Same "never throws or rejects" shape as
 * `postQabCatalogBatch` (F-002), so a failure on one business's request can never abort
 * the run of the others (acceptance criterion 11).
 *
 * This file also carries "Nivel 1" of criterion 3's verification, decided in the
 * contract's own § Verificación: substitute `global.fetch`, call the real client, and
 * read `init.body` back as JSON. The check is on the KEY SET of the body — root and each
 * item — not on the absence of one guessed synonym, because listing what IS there is the
 * only way that is robust against a synonym the guess didn't anticipate.
 */

const batch: IQabAvailabilityBatch = {
  businessId: "negocio-1",
  items: [{ storeProductId: "pt-1", storeId: "tienda-1", availability: "OUT_OF_STOCK" }],
};

function okResponse(applied = 1, confirmed: Array<[string, string]> = [["pt-1", "tienda-1"]]) {
  return new Response(JSON.stringify({ applied, confirmed }), { status: 200 });
}

describe("postQabAvailabilityBatch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST to qabAvailabilitySyncUrl(baseUrl) with the bearer token and a JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "secret-token", batch });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(qabAvailabilitySyncUrl("https://qab.example"));
    expect(init.method).toBe("POST");
  });

  it("should send exactly Authorization: Bearer <token> and Content-Type: application/json, nothing else assumed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "secret-token", batch });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
  });

  it("should send JSON.stringify(batch) and nothing else as the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe(JSON.stringify(batch));
  });

  it("criterion 3 (nivel 1): the sent body's root keys are EXACTLY [businessId, items]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(Object.keys(sent)).toEqual(["businessId", "items"]);
  });

  it("criterion 3 (nivel 1): each item's keys are EXACTLY [storeProductId, storeId, availability]", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(Object.keys(sent.items[0])).toEqual(["storeProductId", "storeId", "availability"]);
  });

  it("criterion 3: no key of the sent body, at any level, is a numeric synonym of stock quantity", () => {
    const forbidden = ["existencia", "stock", "cantidad", "umbralBajo", "lowStockThreshold", "quantity"];
    const sent = { ...batch };

    for (const key of forbidden) {
      expect(Object.keys(sent)).not.toContain(key);
      expect(Object.keys(sent.items[0])).not.toContain(key);
    }
  });

  it("the only value of availability sent is one of the three-value enum", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body as string);
    expect(["OUT_OF_STOCK", "LOW_STOCK", "AVAILABLE"]).toContain(sent.items[0].availability);
  });

  it('should return kind: "ok" with the parsed response on a 200 that validates', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(1, [["pt-1", "tienda-1"]])));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome).toEqual({ kind: "ok", response: { applied: 1, confirmed: [["pt-1", "tienda-1"]] } });
  });

  it('should return kind: "ok" for applied: 0 with everything confirmed — the normal reenvío-idéntico result (ADR 0050)', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(0, [["pt-1", "tienda-1"]])));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.response.applied).toBe(0);
    }
  });

  it("should return kind: error on any status other than 200, even a documented one like 403 BUSINESS_MISMATCH", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("BUSINESS_MISMATCH", { status: 403 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error).toBe(qabHttpErrorMessage(403, "BUSINESS_MISMATCH"));
    }
  });

  it("should return kind: error with INVALID_RESPONSE_BODY when a 200 body does not satisfy the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ applied: "not-a-number" }), { status: 200 }))
    );

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.startsWith("INVALID_RESPONSE_BODY:")).toBe(true);
    }
  });

  it("should return kind: error with INVALID_RESPONSE_BODY when a 200 body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<not json>", { status: 200 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.startsWith("INVALID_RESPONSE_BODY:")).toBe(true);
    }
  });

  it("should NEVER throw or reject on a network failure: it becomes kind: error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch })
    ).resolves.toEqual({ kind: "error", error: qabTransportErrorMessage(new Error("ECONNREFUSED")) });
  });

  it("should never leak the token into the returned outcome", async () => {
    const token = "super-secret-availability-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token, batch });

    expect(JSON.stringify(outcome)).not.toContain(token);
  });

  it("should never log the token, on any code path", async () => {
    const token = "super-secret-availability-token-2";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token, batch });

    for (const spy of [logSpy, errorSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        expect(call.join(" ")).not.toContain(token);
      }
    }
  });

  it("should never log the response body of a third party, ok or not", async () => {
    const marker = "unique-body-marker-should-never-be-logged";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(marker, { status: 500 })));

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    for (const spy of [logSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        expect(call.join(" ")).not.toContain(marker);
      }
    }
  });

  it("should bound the request with AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse()));

    await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(timeoutSpy).toHaveBeenCalledWith(QAB_HTTP_TIMEOUT_MS);
  });

  // Was written against QAB_HTTP_MAX_RESPONSE_BYTES (100 000): the exact defect
  // ADR 0051 fixes. Corrected to this client's own, larger cap — a
  // Content-Length of QAB_HTTP_MAX_RESPONSE_BYTES + 1 is comfortably UNDER
  // QAB_AVAILABILITY_MAX_RESPONSE_BYTES and must NOT be rejected; the "full
  // page regression" describe block below covers that positive case.
  it("should treat a Content-Length past QAB_AVAILABILITY_MAX_RESPONSE_BYTES as an error, without reading the body", async () => {
    const explode = () => {
      throw new Error("must not read the body once Content-Length exceeds the cap");
    };
    const oversizedResponse = {
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length"
            ? String(QAB_AVAILABILITY_MAX_RESPONSE_BYTES + 1)
            : null,
      },
      text: explode,
      json: explode,
      body: { cancel: vi.fn().mockResolvedValue(undefined), getReader: explode },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversizedResponse));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome).toEqual({
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
    });
  });
});

/**
 * Contract § "Obligatorio: regresión a escala de página completa" / ADR 0051. This is the
 * exact case that stalled a business forever under the old (F-002) cap: a FULL page of
 * QAB_AVAILABILITY_BATCH_SIZE confirmations measures ~160 030 bytes for uuid ids (matching
 * the ADR's own measurement), which the old 100 000-byte cap always rejected — and because
 * the divergence query's order is deterministic, the next run retried the exact same page
 * with the exact same result. No fixture in this file before now got anywhere near that
 * volume; every one used a handful of items, which is why this defect reached QA in cycle 1
 * with 136 green tests and none of them decorative.
 */
describe("full page regression — QAB_AVAILABILITY_BATCH_SIZE confirmations (ADR 0051)", () => {
  /** 36-character strings: the length @default(uuid()) produces. Deterministic, not
   * crypto.randomUUID(), so a failure here is reproducible. */
  function uuidLike(seed: number): string {
    return `aaaaaaaa-bbbb-4ccc-8ddd-${String(seed).padStart(12, "0")}`;
  }

  function confirmedResponseBody(n: number): string {
    const confirmed: Array<[string, string]> = Array.from({ length: n }, (_, i) => [
      uuidLike(i),
      uuidLike(i + 1_000_000),
    ]);
    return JSON.stringify({ applied: n, confirmed });
  }

  it("should confirm a FULL page of QAB_AVAILABILITY_BATCH_SIZE items as kind: ok — NOT TRANSPORT:RESPONSE_TOO_LARGE — the exact case ADR 0051 documents as broken under the old F-002 cap", async () => {
    const body = confirmedResponseBody(QAB_AVAILABILITY_BATCH_SIZE);
    // Sanity on the fixture itself, so this test cannot pass vacuously
    // regardless of which cap the client actually uses: it must exceed the
    // OLD, wrong cap and stay within the real one.
    expect(Buffer.byteLength(body)).toBeGreaterThan(QAB_HTTP_MAX_RESPONSE_BYTES);
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(QAB_AVAILABILITY_MAX_RESPONSE_BYTES);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.response.confirmed).toHaveLength(QAB_AVAILABILITY_BATCH_SIZE);
    }
  });

  it("should still reject a body genuinely over QAB_AVAILABILITY_MAX_RESPONSE_BYTES as TRANSPORT:RESPONSE_TOO_LARGE — the negative that keeps the case above from discriminating nothing (E-008)", async () => {
    let n = QAB_AVAILABILITY_BATCH_SIZE;
    let body = confirmedResponseBody(n);
    while (Buffer.byteLength(body) <= QAB_AVAILABILITY_MAX_RESPONSE_BYTES) {
      n += 500;
      body = confirmedResponseBody(n);
    }

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome).toEqual({
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
    });
  });

  it("should return kind: error with INVALID_RESPONSE_BODY when confirmed carries QAB_AVAILABILITY_BATCH_SIZE + 1 entries — a well-formed response can never confirm more pairs than the page it answers carried, so it is NOT truncated or ignored, it fails validation (ADR 0051)", async () => {
    // Deliberately small ids: this body sits far under the byte cap, so only
    // the schema's .max(QAB_AVAILABILITY_BATCH_SIZE) can be what rejects it —
    // this test would not discriminate against readBoundedBody's byte cap.
    const confirmed: Array<[string, string]> = Array.from(
      { length: QAB_AVAILABILITY_BATCH_SIZE + 1 },
      (_, i) => [`pt-${i}`, `tienda-${i}`]
    );
    const body = JSON.stringify({ applied: confirmed.length, confirmed });
    expect(Buffer.byteLength(body)).toBeLessThan(QAB_AVAILABILITY_MAX_RESPONSE_BYTES);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const outcome = await postQabAvailabilityBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.startsWith("INVALID_RESPONSE_BODY:")).toBe(true);
    }
  });
});
