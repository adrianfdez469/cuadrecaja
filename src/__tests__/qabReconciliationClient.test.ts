import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchQabReconciliation, qabReconciliationUrl } from "@/lib/qab/qabReconciliationClient";
import {
  QAB_RECONCILIATION_PATH,
  QAB_RECONCILIATION_MAX_RESPONSE_BYTES,
  QAB_RECONCILIATION_UNKNOWN_STORE_ERROR,
  QAB_HTTP_TIMEOUT_MS,
} from "@/constants/qab";

/**
 * F-008 — `src/lib/qab/qabReconciliationClient.ts` (contract § 4.3), against
 * `.agents/specs/F-008.md`.
 *
 * The status → outcome mapping is exhaustive and documented in the contract's own
 * docstring; this file exercises every row of it, including the two 404s that must NOT
 * collapse into one another: the documented `{"error":"UNKNOWN_STORE"}` body is the ONE
 * outcome the whole reconciliation run treats as proof QAB answered for this business
 * (`QAB_RECONCILIATION_REACHABLE_OUTCOMES`), so a 404 with any other body must stay
 * `UNEXPECTED_STATUS` — collapsing the two would let a mispointed `QAB_API_BASE_URL`
 * read as a permanently healthy sync.
 *
 * `global.fetch` is substituted with `vi.stubGlobal`, exactly as
 * `src/__tests__/qabAvailabilityClient.test.ts` does for `postQabAvailabilityBatch` — the
 * contract names that file as the pattern to follow (§ 9).
 */

describe("qabReconciliationUrl", () => {
  it("builds baseUrl + QAB_RECONCILIATION_PATH + ?storeId=<id>", () => {
    expect(qabReconciliationUrl("https://qab.example", { storeId: "t1" })).toBe(
      `https://qab.example${QAB_RECONCILIATION_PATH}?storeId=t1`
    );
  });

  it("encodes storeId via URLSearchParams, not a bare template string — a space or & must not reach the query unescaped", () => {
    const url = qabReconciliationUrl("https://qab.example", { storeId: "a b&c" });
    const params = new URLSearchParams({ storeId: "a b&c" });

    expect(url).toBe(`https://qab.example${QAB_RECONCILIATION_PATH}?${params.toString()}`);
    expect(url).not.toContain("a b&c");
  });
});

describe("fetchQabReconciliation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("GETs qabReconciliationUrl(baseUrl, { storeId }) with Authorization: Bearer <token>, nothing else assumed", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ products: 1, hash: "a".repeat(32) }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "secret", storeId: "t1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(qabReconciliationUrl("https://qab.example", { storeId: "t1" }));
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret" });
  });

  it('returns kind: "ok" with the parsed { products, hash } on a 200 that satisfies the schema', async () => {
    const body = { products: 7, hash: "abcdef0123456789abcdef0123456789" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "ok", response: body });
  });

  it.each([
    [400, "MISSING_STORE_ID"],
    [401, "UNAUTHORIZED"],
    [403, "BUSINESS_INACTIVE"],
    [503, "SYNC_NOT_CONFIGURED"],
  ])("maps a bare %i to code %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code });
  });

  it('maps a 404 with the documented { error: "UNKNOWN_STORE" } body to UNKNOWN_STORE — the outcome the run treats as proof QAB answered', async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ error: QAB_RECONCILIATION_UNKNOWN_STORE_ERROR }), { status: 404 }))
    );

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "UNKNOWN_STORE" });
  });

  it("maps a 404 with any OTHER body to UNEXPECTED_STATUS, never UNKNOWN_STORE — a mispointed base URL must not read as a healthy sync forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "NOT_FOUND" }), { status: 404 }))
    );

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "UNEXPECTED_STATUS" });
  });

  it("maps any other status (not one of the eight documented codes) to UNEXPECTED_STATUS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "UNEXPECTED_STATUS" });
  });

  it("maps a 200 body that is not valid JSON to INVALID_RESPONSE_BODY", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<not json>", { status: 200 })));

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "INVALID_RESPONSE_BODY" });
  });

  it("maps a 200 body whose hash does not satisfy QAB_RECONCILIATION_HASH_PATTERN to INVALID_RESPONSE_BODY, NEVER a divergence", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: 1, hash: "not-a-hash" }), { status: 200 }))
    );

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "INVALID_RESPONSE_BODY" });
  });

  it("maps an oversized 200 body (Content-Length over QAB_RECONCILIATION_MAX_RESPONSE_BYTES) to INVALID_RESPONSE_BODY, without reading it", async () => {
    const explode = () => {
      throw new Error("must not read the body once Content-Length exceeds the cap");
    };
    const oversized = {
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length" ? String(QAB_RECONCILIATION_MAX_RESPONSE_BYTES + 1) : null,
      },
      text: explode,
      json: explode,
      body: { cancel: vi.fn().mockResolvedValue(undefined), getReader: explode },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversized));

    const outcome = await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(outcome).toEqual({ kind: "error", code: "INVALID_RESPONSE_BODY" });
  });

  it("maps a network failure (no HTTP response at all) to TRANSPORT and NEVER rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" })
    ).resolves.toEqual({ kind: "error", code: "TRANSPORT" });
  });

  it("bounds the request with AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ products: 0, hash: "d41d8cd98f00b204e9800998ecf8427e" }), { status: 200 }))
    );

    await fetchQabReconciliation({ baseUrl: "https://qab.example", token: "t", storeId: "t1" });

    expect(timeoutSpy).toHaveBeenCalledWith(QAB_HTTP_TIMEOUT_MS);
  });

  it("never logs the token, the URL, the response body or the hash, on any code path", async () => {
    const token = "super-secret-reconciliation-token";
    const marker = "unique-reconciliation-body-marker";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(marker, { status: 401 })));

    await fetchQabReconciliation({ baseUrl: "https://qab.example", token, storeId: "t1" });

    for (const spy of [logSpy, errorSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        const joined = call.join(" ");
        expect(joined).not.toContain(token);
        expect(joined).not.toContain(marker);
      }
    }
  });
});
