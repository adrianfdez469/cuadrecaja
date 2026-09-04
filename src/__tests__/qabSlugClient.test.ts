import { describe, it, expect, vi, afterEach } from "vitest";
import {
  qabSlugAvailabilityUrl,
  isRetryableSlugCode,
  fetchQabSlugAvailability,
} from "@/lib/qab/qabSlugClient";
import {
  QAB_SLUG_AVAILABILITY_PATH,
  QAB_SLUG_UPSTREAM_CODES,
  QAB_SLUG_RETRYABLE_CODES,
  QAB_HTTP_TIMEOUT_MS,
  QAB_HTTP_MAX_RESPONSE_BYTES,
} from "@/constants/qab";

/**
 * F-005 — `src/lib/qab/qabSlugClient.ts` (contract §5.4, ADR 0033). Same technique as
 * `qabCatalogClient.test.ts`: `qabSlugAvailabilityUrl` and `isRetryableSlugCode` are pure,
 * `fetchQabSlugAvailability` is exercised against a mocked `global.fetch`.
 *
 * The contract is explicit that this function NEVER throws (every failure comes back as
 * `{ kind: "error" }`, mirroring `postQabCatalogBatch`) and logs nothing — not the token, not
 * the URL, not the body. Both are asserted here, not assumed.
 */

const VALID_FORECAST_BODY = {
  candidate: "sucursal-vedado",
  available: true,
  reason: "free",
  resolvedSlug: "sucursal-vedado",
  url: "https://tienda.example/sucursal-vedado",
  storeKnown: false,
};

describe("qabSlugAvailabilityUrl", () => {
  it("should append QAB_SLUG_AVAILABILITY_PATH to the base URL", () => {
    const url = qabSlugAvailabilityUrl("https://qab.example", { slug: "tienda" });
    expect(url.startsWith(`https://qab.example${QAB_SLUG_AVAILABILITY_PATH}`)).toBe(true);
  });

  it("should encode slug as a query parameter", () => {
    const url = qabSlugAvailabilityUrl("https://qab.example", { slug: "tienda demo" });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("slug")).toBe("tienda demo");
  });

  it("should encode name and storeId when given", () => {
    const url = qabSlugAvailabilityUrl("https://qab.example", {
      name: "Bodega Central",
      storeId: "a3f1a1a1-1111-4111-8111-111111111111",
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("name")).toBe("Bodega Central");
    expect(parsed.searchParams.get("storeId")).toBe("a3f1a1a1-1111-4111-8111-111111111111");
  });

  it("should omit query parameters that were not given", () => {
    const url = qabSlugAvailabilityUrl("https://qab.example", { slug: "tienda" });
    const parsed = new URL(url);
    expect(parsed.searchParams.has("name")).toBe(false);
    expect(parsed.searchParams.has("storeId")).toBe(false);
  });
});

describe("isRetryableSlugCode", () => {
  it.each([...QAB_SLUG_RETRYABLE_CODES])("should mark %s as retryable", (code) => {
    expect(isRetryableSlugCode(code)).toBe(true);
  });

  const nonRetryable = QAB_SLUG_UPSTREAM_CODES.filter(
    (code) => !(QAB_SLUG_RETRYABLE_CODES as readonly string[]).includes(code)
  );

  it.each(nonRetryable)("should mark %s as NOT retryable", (code) => {
    expect(isRetryableSlugCode(code)).toBe(false);
  });
});

describe("fetchQabSlugAvailability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should GET with the bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(VALID_FORECAST_BODY), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "secret-token",
      query: { slug: "sucursal-vedado" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url).startsWith("https://qab.example" + QAB_SLUG_AVAILABILITY_PATH)).toBe(true);
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("should return kind: ok with the parsed forecast on a 200 that validates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(VALID_FORECAST_BODY), { status: 200 }))
    );

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "sucursal-vedado" },
    });

    expect(outcome).toEqual({ kind: "ok", forecast: VALID_FORECAST_BODY });
  });

  it("should return kind: error INVALID_RESPONSE_BODY when a 200 body does not satisfy the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidate: "x" }), { status: 200 }))
    );

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "x" },
    });

    expect(outcome).toEqual({ kind: "error", code: "INVALID_RESPONSE_BODY" });
  });

  it("should return kind: error INVALID_RESPONSE_BODY when a 200 body is not valid JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<not json>", { status: 200 })));

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "x" },
    });

    expect(outcome).toEqual({ kind: "error", code: "INVALID_RESPONSE_BODY" });
  });

  it.each([
    [400, "MISSING_QUERY"],
    [401, "UNAUTHORIZED"],
    [403, "BUSINESS_INACTIVE"],
    [503, "SYNC_NOT_CONFIGURED"],
  ])("should map HTTP %d to %s", async (status, expectedCode) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("body", { status })));

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "x" },
    });

    expect(outcome).toEqual({ kind: "error", code: expectedCode });
  });

  it("should map an undocumented status to UNEXPECTED_STATUS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("body", { status: 418 })));

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "x" },
    });

    expect(outcome).toEqual({ kind: "error", code: "UNEXPECTED_STATUS" });
  });

  it("should NEVER throw or reject: a network failure becomes kind: error TRANSPORT", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(
      fetchQabSlugAvailability({ baseUrl: "https://qab.example", token: "t", query: { slug: "x" } })
    ).resolves.toEqual({ kind: "error", code: "TRANSPORT" });
  });

  it("should bound the request with AbortSignal.timeout(QAB_HTTP_TIMEOUT_MS)", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(VALID_FORECAST_BODY), { status: 200 }))
    );

    await fetchQabSlugAvailability({ baseUrl: "https://qab.example", token: "t", query: { slug: "x" } });

    expect(timeoutSpy).toHaveBeenCalledWith(QAB_HTTP_TIMEOUT_MS);
  });

  it("should treat an oversized response (Content-Length past the cap) as TRANSPORT, without reading the body", async () => {
    const explode = () => {
      throw new Error("must not read the body once Content-Length exceeds the cap");
    };
    const oversizedResponse = {
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-length" ? String(QAB_HTTP_MAX_RESPONSE_BYTES + 1) : null,
      },
      text: explode,
      json: explode,
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(oversizedResponse));

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "t",
      query: { slug: "x" },
    });

    expect(outcome).toEqual({ kind: "error", code: "TRANSPORT" });
  });

  it("should never leak the token into the returned outcome", async () => {
    const token = "super-secret-slug-token";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })));

    const outcome = await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token,
      query: { slug: "x" },
    });

    expect(JSON.stringify(outcome)).not.toContain(token);
  });

  it("should log nothing at all: not the token, the URL, or the response body", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("server exploded", { status: 500 })));

    await fetchQabSlugAvailability({
      baseUrl: "https://qab.example",
      token: "super-secret-slug-token",
      query: { slug: "x" },
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
