import { describe, it, expect } from "vitest";
import { resolveQabBaseUrl, qabCatalogSyncUrl, QabConfigError } from "@/lib/qab/qabEnv";
import { QAB_CATALOG_SYNC_PATH } from "@/constants/qab";

/**
 * F-002 — `src/lib/qab/qabEnv.ts`. `resolveQabBaseUrl` is the one place that decides
 * whether the sync cron runs, no-ops (ADR 0014), or fails its configuration (500). Every
 * branch here is a criterion 2/`QAB_CONFIG_INVALID` path, and the http-in-production
 * rejection is a security-guardian finding recorded in the contract: the qabToken travels
 * in a bare Authorization header on every catalog POST.
 */

describe("resolveQabBaseUrl", () => {
  it("should return null when QAB_API_BASE_URL is absent", () => {
    expect(resolveQabBaseUrl({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("should return null when QAB_API_BASE_URL is blank", () => {
    expect(resolveQabBaseUrl({ QAB_API_BASE_URL: "   " } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("should accept a well formed https origin verbatim", () => {
    expect(
      resolveQabBaseUrl({ QAB_API_BASE_URL: "https://queandabuscando.example" } as unknown as NodeJS.ProcessEnv)
    ).toBe("https://queandabuscando.example");
  });

  it("should trim surrounding whitespace", () => {
    expect(
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "  https://queandabuscando.example  ",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("https://queandabuscando.example");
  });

  it("should strip every trailing slash, not just one", () => {
    expect(
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example///",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("https://queandabuscando.example");
  });

  it("should keep a non-default port", () => {
    expect(
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example:8443",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("https://queandabuscando.example:8443");
  });

  it("should throw QabConfigError on a value that does not parse as a URL", () => {
    expect(() =>
      resolveQabBaseUrl({ QAB_API_BASE_URL: "not a url" } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should throw QabConfigError on a protocol other than http/https", () => {
    expect(() =>
      resolveQabBaseUrl({ QAB_API_BASE_URL: "ftp://queandabuscando.example" } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should throw QabConfigError on a path beyond the bare origin", () => {
    expect(() =>
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example/api",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should throw QabConfigError on a query string", () => {
    expect(() =>
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example?x=1",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should throw QabConfigError on a hash fragment", () => {
    expect(() =>
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example#section",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should throw QabConfigError on embedded userinfo (credentials in the URL)", () => {
    expect(() =>
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://user:secret@queandabuscando.example",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should allow http: outside production, for a local mock during development", () => {
    expect(
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "http://localhost:4000",
        NODE_ENV: "development",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("http://localhost:4000");
  });

  it("should allow http: when NODE_ENV is not set at all", () => {
    expect(
      resolveQabBaseUrl({ QAB_API_BASE_URL: "http://localhost:4000" } as unknown as NodeJS.ProcessEnv)
    ).toBe("http://localhost:4000");
  });

  it("should throw QabConfigError on http: in production: the qabToken would travel in the clear", () => {
    expect(() =>
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "http://queandabuscando.example",
        NODE_ENV: "production",
      } as unknown as NodeJS.ProcessEnv)
    ).toThrow(QabConfigError);
  });

  it("should still allow https: in production", () => {
    expect(
      resolveQabBaseUrl({
        QAB_API_BASE_URL: "https://queandabuscando.example",
        NODE_ENV: "production",
      } as unknown as NodeJS.ProcessEnv)
    ).toBe("https://queandabuscando.example");
  });

  it("should default to process.env when called without an argument", () => {
    const original = process.env.QAB_API_BASE_URL;
    delete process.env.QAB_API_BASE_URL;
    try {
      expect(resolveQabBaseUrl()).toBeNull();
    } finally {
      if (original === undefined) delete process.env.QAB_API_BASE_URL;
      else process.env.QAB_API_BASE_URL = original;
    }
  });
});

describe("qabCatalogSyncUrl", () => {
  it("should append the contract's catalog sync path to the resolved origin", () => {
    expect(qabCatalogSyncUrl("https://queandabuscando.example")).toBe(
      `https://queandabuscando.example${QAB_CATALOG_SYNC_PATH}`
    );
  });

  it("should not double a slash when concatenating", () => {
    const url = qabCatalogSyncUrl("https://queandabuscando.example");
    expect(url).not.toMatch(/\/\/api/);
  });
});
