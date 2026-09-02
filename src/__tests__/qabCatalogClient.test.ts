import { describe, it, expect, vi, afterEach } from "vitest";
import { qabHttpErrorMessage, qabTransportErrorMessage, postQabCatalogBatch } from "@/lib/qab/qabCatalogClient";
import {
  QAB_OUTBOX_ERROR_MAX_LENGTH,
  QAB_HTTP_TIMEOUT_MS,
  QAB_HTTP_MAX_RESPONSE_BYTES,
  QAB_CATALOG_SYNC_PATH,
} from "@/constants/qab";
import type { IQabCatalogBatch } from "@/schemas/qabSync";

/**
 * F-002 — `src/lib/qab/qabCatalogClient.ts`. `qabHttpErrorMessage` and
 * `qabTransportErrorMessage` are pure per the contract. `postQabCatalogBatch` is not —
 * it calls `fetch` — but it never touches the database, so it is exercised here against
 * a mocked `global.fetch`, the same technique used for elTOQUE elsewhere in this suite.
 *
 * The contract is explicit that this function must NEVER throw or reject: every failure
 * comes back as `{ kind: "error" }` so one business can never abort the drain of the
 * others. That invariant, the response-size cap (a security-guardian finding), and the
 * "never leak the token" rule are the three things worth a database-free test here.
 */

describe("qabHttpErrorMessage", () => {
  it("should prefix with HTTP:<status>: followed by the body", () => {
    expect(qabHttpErrorMessage(500, "Internal Server Error")).toBe("HTTP:500:Internal Server Error");
  });

  it("should collapse internal whitespace runs (newlines, tabs, repeated spaces) into single spaces", () => {
    expect(qabHttpErrorMessage(400, "line one\n\n line two \t\t line three")).toBe(
      "HTTP:400:line one line two line three"
    );
  });

  it("should never exceed QAB_OUTBOX_ERROR_MAX_LENGTH, even with a very long body", () => {
    const hugeBody = "x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH * 3);
    expect(qabHttpErrorMessage(502, hugeBody).length).toBeLessThanOrEqual(QAB_OUTBOX_ERROR_MAX_LENGTH);
  });
});

describe("qabTransportErrorMessage", () => {
  it("should prefix an Error's message with TRANSPORT:", () => {
    expect(qabTransportErrorMessage(new Error("socket hang up"))).toBe("TRANSPORT:socket hang up");
  });

  it("should stringify a non-Error thrown value", () => {
    expect(qabTransportErrorMessage("plain string failure")).toBe("TRANSPORT:plain string failure");
  });

  it("should never exceed QAB_OUTBOX_ERROR_MAX_LENGTH", () => {
    const huge = new Error("x".repeat(QAB_OUTBOX_ERROR_MAX_LENGTH * 3));
    expect(qabTransportErrorMessage(huge).length).toBeLessThanOrEqual(QAB_OUTBOX_ERROR_MAX_LENGTH);
  });
});

describe("postQabCatalogBatch", () => {
  const batch: IQabCatalogBatch = {
    businessId: "negocio-1",
    events: [
      {
        eventId: "1",
        entity: "PRODUCT",
        operation: "UPDATE",
        occurredAt: "2026-09-01T10:00:00.000Z",
        payload: { storeProductId: "pt-1" },
      },
    ],
  };

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST to <baseUrl><QAB_CATALOG_SYNC_PATH> with the bearer token and a JSON body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: ["1"], failed: [], results: [] }), { status: 207 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "secret-token", batch });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://qab.example${QAB_CATALOG_SYNC_PATH}`);
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual(batch);
  });

  it("should return kind: ok with the parsed body on a 207 that validates", async () => {
    const responseBody = { ok: ["1"], failed: [], results: [{ eventId: "1", status: "processed" }] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 207 }))
    );

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome).toEqual({ kind: "ok", response: responseBody });
  });

  it("should return kind: error with an HTTP: prefixed message on any status other than 207", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Business token expired", { status: 403 }))
    );

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.ultimoError).toBe(qabHttpErrorMessage(403, "Business token expired"));
    }
  });

  it("should return kind: error with INVALID_RESPONSE_BODY when a 207 body does not match the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: "not-an-array" }), { status: 207 }))
    );

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.ultimoError.startsWith("INVALID_RESPONSE_BODY:")).toBe(true);
    }
  });

  it("should return kind: error with INVALID_RESPONSE_BODY when a 207 body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<not json>", { status: 207 })));

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.ultimoError.startsWith("INVALID_RESPONSE_BODY:")).toBe(true);
    }
  });

  it("should NEVER throw or reject: a network failure becomes kind: error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch })
    ).resolves.toEqual({ kind: "error", ultimoError: "TRANSPORT:ECONNREFUSED" });
  });

  it("should never leak the token into the returned outcome", async () => {
    const token = "super-secret-token-value";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token, batch });

    expect(JSON.stringify(outcome)).not.toContain(token);
  });

  it("should bound the request with AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ ok: [], failed: [], results: [] }), { status: 207 })
        )
    );

    await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(timeoutSpy).toHaveBeenCalledWith(QAB_HTTP_TIMEOUT_MS);
  });

  it("should treat a Content-Length past QAB_HTTP_MAX_RESPONSE_BYTES as TRANSPORT:RESPONSE_TOO_LARGE, without reading the body", async () => {
    const explode = () => {
      throw new Error("must not read the body once Content-Length exceeds the cap");
    };
    const oversizedResponse = {
      status: 207,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length" ? String(QAB_HTTP_MAX_RESPONSE_BYTES + 1) : null,
      },
      text: explode,
      json: explode,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversizedResponse));

    const outcome = await postQabCatalogBatch({ baseUrl: "https://qab.example", token: "t", batch });

    expect(outcome).toEqual({ kind: "error", ultimoError: "TRANSPORT:RESPONSE_TOO_LARGE" });
  });
});
