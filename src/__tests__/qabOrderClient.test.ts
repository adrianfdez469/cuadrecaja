import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchQabOrdersPage,
  qabOrderPullMaxResponseBytes,
  qabOrderHttpErrorMessage,
} from "@/lib/qab/qabOrderClient";
import { qabTransportErrorMessage } from "@/lib/qab/qabCatalogClient";
import { qabOrdersPullUrl } from "@/lib/qab/qabEnv";
import {
  QAB_HTTP_TIMEOUT_MS,
  QAB_HTTP_MAX_RESPONSE_BYTES,
  QAB_HTTP_RESPONSE_TOO_LARGE_REASON,
  QAB_OUTBOX_ERROR_CODES,
  QAB_ORDER_PULL_PAGE_SIZE,
  QAB_ORDER_MAX_BYTES,
  QAB_ORDER_MAX_LINES,
  QAB_ORDER_LINE_NAME_MAX_LENGTH,
  QAB_ORDER_TEXT_MAX_LENGTH,
  QAB_ORDER_CONTACT_MAX_LENGTH,
  QAB_ORDER_URL_MAX_LENGTH,
  QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES,
  QAB_ORDER_CODE_MAX_LENGTH,
  QAB_ORDER_CURRENCY_CODE_MAX_LENGTH,
} from "@/constants/qab";

/**
 * F-010 — `src/lib/qab/qabOrderClient.ts` (contract § same name, ADR 0055). The
 * fourth "never throws or rejects" client, same shape as `postQabCatalogBatch` /
 * `postQabAvailabilityBatch`, so a failure fetching one business's page can never
 * abort the run of the others (criterion 12).
 *
 * Two things this file is written to be strict about, per the contract:
 *
 *  - `qabOrderHttpErrorMessage(status)` NEVER embeds the response body — unlike
 *    `qabHttpErrorMessage(status, body)`, reused by the catalog/availability
 *    clients. The body of THIS route carries `Order.code` (criterion 11), so the
 *    difference is structural, not a promise to remember not to log it.
 *  - The response cap is COMPUTED from `limit`, never `QAB_HTTP_MAX_RESPONSE_BYTES`
 *    (ADR 0055/[E-029]). The "full page regression" block below is the exact shape
 *    of the defect that ADR describes for another client: a fixture too small to
 *    ever discriminate a wrong, inherited cap from the real one.
 */

const BASE_URL = "https://qab.example";

function okResponse(body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("fetchQabOrdersPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should GET qabOrdersPullUrl(baseUrl, { since, limit }) with no body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ orders: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: "42", limit: 100 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(qabOrdersPullUrl(BASE_URL, { since: "42", limit: 100 }));
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("should send exactly Authorization: Bearer <token>, and no Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse({ orders: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "secret-token", since: null, limit: 100 });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("should bound the request with AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ orders: [], nextCursor: null })));

    await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(timeoutSpy).toHaveBeenCalledWith(QAB_HTTP_TIMEOUT_MS);
  });

  it('should return kind: "ok" with the parsed page on a 200 that validates', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okResponse({ orders: [{ id: "1" }], nextCursor: "1" })),
    );

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.page).toEqual({ orders: [{ id: "1" }], nextCursor: "1" });
    }
  });

  it('should return kind: "ok" for nextCursor: null — "up to date", never an error', async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ orders: [], nextCursor: null })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: "1", limit: 100 });

    expect(outcome.kind).toBe("ok");
  });

  it("should return kind: error, tooLarge: false and use qabOrderHttpErrorMessage (NOT qabHttpErrorMessage) on any non-200 status", async () => {
    const marker = "unique-order-code-marker-should-never-appear";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(marker, { status: 500 })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(outcome).toEqual({ kind: "error", error: qabOrderHttpErrorMessage(500), tooLarge: false });
    expect(outcome.kind === "error" && outcome.error).not.toContain(marker);
  });

  it("should return kind: error with tooLarge: true when the body exceeds qabOrderPullMaxResponseBytes(limit)", async () => {
    const limit = 100;
    const oversized = {
      status: 200,
      headers: { get: (name: string) => (name.toLowerCase() === "content-length" ? String(qabOrderPullMaxResponseBytes(limit) + 1) : null) },
      text: () => {
        throw new Error("must not read the body once Content-Length exceeds the cap");
      },
      json: () => {
        throw new Error("must not read the body once Content-Length exceeds the cap");
      },
      body: { cancel: vi.fn().mockResolvedValue(undefined), getReader: () => { throw new Error("must not read"); } },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversized));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit });

    expect(outcome).toEqual({
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
      tooLarge: true,
    });
  });

  it("tooLarge: true should be the ONLY outcome shape carrying tooLarge: true — a normal error carries tooLarge: false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 401 })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(outcome.kind).toBe("error");
    expect(outcome.kind === "error" && outcome.tooLarge).toBe(false);
  });

  it("should return kind: error with the invalidResponseBody code when a 200 body does not satisfy qabOrdersPageSchema", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse({ orders: "not-an-array" })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.startsWith(`${QAB_OUTBOX_ERROR_CODES.invalidResponseBody}:`)).toBe(true);
      expect(outcome.tooLarge).toBe(false);
    }
  });

  it("should return kind: error with the invalidResponseBody code when a 200 body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<not json>", { status: 200 })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.error.startsWith(`${QAB_OUTBOX_ERROR_CODES.invalidResponseBody}:`)).toBe(true);
    }
  });

  it("should NEVER throw or reject on a network failure: it becomes kind: error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit: 100 }),
    ).resolves.toEqual({
      kind: "error",
      error: qabTransportErrorMessage(new Error("ECONNREFUSED")),
      tooLarge: false,
    });
  });

  it("should never leak the token into the returned outcome", async () => {
    const token = "super-secret-order-poll-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token, since: null, limit: 100 });

    expect(JSON.stringify(outcome)).not.toContain(token);
  });

  it("should never log the token or the response body, on any code path", async () => {
    const token = "super-secret-order-poll-token-2";
    const bodyMarker = "unique-body-marker-should-never-be-logged";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bodyMarker, { status: 500 })));

    await fetchQabOrdersPage({ baseUrl: BASE_URL, token, since: null, limit: 100 });

    for (const spy of [logSpy, errorSpy]) {
      for (const call of spy.mock.calls) {
        const text = call.join(" ");
        expect(text).not.toContain(token);
        expect(text).not.toContain(bodyMarker);
      }
    }
  });
});

describe("qabOrderHttpErrorMessage", () => {
  it("should be exactly HTTP:<status>, never embedding a body", () => {
    expect(qabOrderHttpErrorMessage(500)).toBe(`${QAB_OUTBOX_ERROR_CODES.http}:500`);
  });

  it("should never contain anything but the status: structurally cannot carry an Order.code", () => {
    expect(qabOrderHttpErrorMessage(403)).toBe(`${QAB_OUTBOX_ERROR_CODES.http}:403`);
    expect(qabOrderHttpErrorMessage(403).length).toBeLessThan(30);
  });
});

/**
 * Contract § ADR 0055 "Cómo se comprueba que esto no se desincroniza", the three
 * mandatory checks, in order — the second is the one that matters, per the ADR's
 * own words: the first is near-tautological (Math.max guarantees it).
 */
describe("qabOrderPullMaxResponseBytes — computed response budget (ADR 0055)", () => {
  it("1. qabOrderPullMaxResponseBytes(1) >= QAB_ORDER_MAX_BYTES (the floor, by construction)", () => {
    expect(qabOrderPullMaxResponseBytes(1)).toBeGreaterThanOrEqual(QAB_ORDER_MAX_BYTES);
  });

  it("2. a REAL worst-case order, fully serialised, fits within QAB_ORDER_MAX_BYTES — the check that actually protects the supuesto vivo", () => {
    const worstCaseOrder = {
      id: "1",
      code: "A".repeat(QAB_ORDER_CODE_MAX_LENGTH),
      storeExternalId: "store-1",
      status: "PENDING",
      cancelledBy: null,
      contact: {
        name: "N".repeat(QAB_ORDER_CONTACT_MAX_LENGTH),
        phone: "P".repeat(QAB_ORDER_CONTACT_MAX_LENGTH),
        email: "E".repeat(QAB_ORDER_CONTACT_MAX_LENGTH),
        address: "D".repeat(QAB_ORDER_CONTACT_MAX_LENGTH),
      },
      currencyCode: "C".repeat(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
      subtotal: "999999999999.99",
      discountTotal: "999999999999.99",
      deliveryFee: "999999999999.99",
      total: "999999999999.99",
      deliveryFeePending: false,
      rateSnapshot: "R".repeat(QAB_ORDER_RATE_SNAPSHOT_MAX_BYTES - 2),
      notes: "T".repeat(QAB_ORDER_TEXT_MAX_LENGTH),
      customerWhatsappUrl: `https://${"w".repeat(QAB_ORDER_URL_MAX_LENGTH - 8)}`,
      proposal: {
        proposedAt: "2026-09-01T10:00:00.000Z",
        expiresAt: "2026-09-02T10:00:00.000Z",
        previousTotal: "999999999999.99",
        subtotal: "999999999999.99",
        discountTotal: "999999999999.99",
        deliveryFee: "999999999999.99",
        total: "999999999999.99",
        message: "M".repeat(QAB_ORDER_TEXT_MAX_LENGTH),
      },
      createdAt: "2026-09-01T10:00:00.000Z",
      items: Array.from({ length: QAB_ORDER_MAX_LINES }, (_, i) => ({
        storeProductExternalId: `spe-${i}`,
        name: "L".repeat(QAB_ORDER_LINE_NAME_MAX_LENGTH),
        unitPrice: "999999999999.99",
        currencyCode: "C".repeat(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
        quantity: "99999999999.999",
        lineTotal: "999999999999.99",
        originalUnitPrice: "999999999999.99",
        originalCurrencyCode: "C".repeat(QAB_ORDER_CURRENCY_CODE_MAX_LENGTH),
        originalLineTotal: "999999999999.99",
      })),
    };

    const bytes = Buffer.byteLength(JSON.stringify(worstCaseOrder), "utf8");
    expect(bytes).toBeLessThanOrEqual(QAB_ORDER_MAX_BYTES);
  });

  it("3a. a FULL page of QAB_ORDER_PULL_PAGE_SIZE typical orders is kind: ok — not TRANSPORT:RESPONSE_TOO_LARGE", async () => {
    function typicalOrder(i: number) {
      return {
        id: String(i + 1),
        code: `CODE${String(i).padStart(6, "0")}`,
        storeExternalId: "store-1",
        status: "PENDING",
        cancelledBy: null,
        contact: { name: "Cliente", phone: "+53555", email: null, address: "Calle 1, número 2" },
        currencyCode: "CUP",
        subtotal: "100.00",
        discountTotal: "0.00",
        deliveryFee: "0.00",
        total: "100.00",
        deliveryFeePending: false,
        rateSnapshot: { rate: "120.00", source: "manual", note: "x".repeat(200) },
        notes: "x".repeat(4_000),
        customerWhatsappUrl: null,
        proposal: null,
        createdAt: "2026-09-01T10:00:00.000Z",
        items: Array.from({ length: 3 }, (_, j) => ({
          storeProductExternalId: `spe-${i}-${j}`,
          name: `Producto de prueba número ${j}`,
          unitPrice: "10.00",
          currencyCode: "CUP",
          quantity: "1.000",
          lineTotal: "10.00",
          originalUnitPrice: null,
          originalCurrencyCode: null,
          originalLineTotal: null,
        })),
      };
    }

    const orders = Array.from({ length: QAB_ORDER_PULL_PAGE_SIZE }, (_, i) => typicalOrder(i));
    const body = JSON.stringify({ orders, nextCursor: null });

    // Sanity on the fixture: it must exceed the OLD, wrong shared cap, and stay
    // within the correct, computed one — otherwise this test cannot discriminate
    // anything (E-008 / the exact mechanism of [E-029]).
    expect(Buffer.byteLength(body)).toBeGreaterThan(QAB_HTTP_MAX_RESPONSE_BYTES);
    expect(Buffer.byteLength(body)).toBeLessThanOrEqual(
      qabOrderPullMaxResponseBytes(QAB_ORDER_PULL_PAGE_SIZE),
    );

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const outcome = await fetchQabOrdersPage({
      baseUrl: BASE_URL,
      token: "t",
      since: null,
      limit: QAB_ORDER_PULL_PAGE_SIZE,
    });

    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.page.orders).toHaveLength(QAB_ORDER_PULL_PAGE_SIZE);
    }

    vi.unstubAllGlobals();
  });

  it("3b. its negative control: a body genuinely over qabOrderPullMaxResponseBytes(limit) must still be tooLarge: true, or 3a would pass with the cap disabled (E-008)", async () => {
    const limit = QAB_ORDER_PULL_PAGE_SIZE;
    const hugeFiller = "x".repeat(qabOrderPullMaxResponseBytes(limit) + 1_000);
    const body = JSON.stringify({ orders: [{ id: "1", filler: hugeFiller }], nextCursor: null });
    expect(Buffer.byteLength(body)).toBeGreaterThan(qabOrderPullMaxResponseBytes(limit));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const outcome = await fetchQabOrdersPage({ baseUrl: BASE_URL, token: "t", since: null, limit });

    expect(outcome).toEqual({
      kind: "error",
      error: `${QAB_OUTBOX_ERROR_CODES.transport}:${QAB_HTTP_RESPONSE_TOO_LARGE_REASON}`,
      tooLarge: true,
    });

    vi.unstubAllGlobals();
  });
});
