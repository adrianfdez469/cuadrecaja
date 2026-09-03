import { describe, it, expect, vi, afterEach } from "vitest";
import {
  formatQabOrphanedTokenLog,
  recordQabOrphanedToken,
} from "@/lib/qab/qabProvisioningAudit";
import { QAB_PROVISIONING_ORPHAN_LOG, QAB_PROVISIONING_ORPHAN_REASONS } from "@/constants/qabProvisioning";

/**
 * F-003 — `src/lib/qab/qabProvisioningAudit.ts` (ADR 0023). Criterion 6 needs a registro
 * explícito of an orphaned token that CANNOT carry the secret, by construction: the property
 * the ADR relies on is that `formatQabOrphanedTokenLog` does not accept a token argument at
 * all, so there is nothing for it to leak even if a caller tried. The tests below check both
 * the observable format (which `qa` greps for while forcing the real failure) and that
 * structural guarantee at runtime, by smuggling a `token` property into the arguments object
 * and confirming it never reaches the output.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";

describe("formatQabOrphanedTokenLog", () => {
  it.each(QAB_PROVISIONING_ORPHAN_REASONS)(
    "should format the exact prefix, negocioId, externalId and reason: %s",
    (reason) => {
      const line = formatQabOrphanedTokenLog({ negocioId: NEGOCIO_ID, externalId: NEGOCIO_ID, reason });

      expect(line).toBe(
        `${QAB_PROVISIONING_ORPHAN_LOG} negocioId=${NEGOCIO_ID} externalId=${NEGOCIO_ID} reason=${reason}`
      );
    }
  );

  it("should hold exactly the four orphan reasons, CONFIRMED_ORPHANED included", () => {
    expect([...QAB_PROVISIONING_ORPHAN_REASONS].sort()).toEqual(
      ["PERSIST_FAILED", "RESPONSE_LOST", "EXTERNAL_ID_MISMATCH", "CONFIRMED_ORPHANED"].sort()
    );
  });

  it("should distinguish negocioId from externalId when they differ (a mismatch scenario)", () => {
    const line = formatQabOrphanedTokenLog({
      negocioId: "negocio-local-id",
      externalId: "some-other-id-qab-minted-for",
      reason: "EXTERNAL_ID_MISMATCH",
    });

    expect(line).toContain("negocioId=negocio-local-id");
    expect(line).toContain("externalId=some-other-id-qab-minted-for");
  });

  it("should be a single line: no embedded newlines, regardless of input", () => {
    const line = formatQabOrphanedTokenLog({
      negocioId: NEGOCIO_ID,
      externalId: NEGOCIO_ID,
      reason: "PERSIST_FAILED",
    });
    expect(line).not.toContain("\n");
  });

  it("cannot leak a token even if one is smuggled into the arguments object", () => {
    // The function's TYPE does not accept `token`. This proves the runtime guarantee holds
    // even against a caller that ignores the type system (e.g. via `as any`).
    const argsWithSmuggledToken = {
      negocioId: NEGOCIO_ID,
      externalId: NEGOCIO_ID,
      reason: "PERSIST_FAILED",
      token: "SUPER_SECRET_QAB_TOKEN_VALUE",
    } as unknown as Parameters<typeof formatQabOrphanedTokenLog>[0];

    const line = formatQabOrphanedTokenLog(argsWithSmuggledToken);

    expect(line).not.toContain("SUPER_SECRET_QAB_TOKEN_VALUE");
  });
});

describe("recordQabOrphanedToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write exactly one line via console.error, matching formatQabOrphanedTokenLog", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    recordQabOrphanedToken({ negocioId: NEGOCIO_ID, externalId: NEGOCIO_ID, reason: "RESPONSE_LOST" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      formatQabOrphanedTokenLog({ negocioId: NEGOCIO_ID, externalId: NEGOCIO_ID, reason: "RESPONSE_LOST" })
    );
  });

  it("should never call console.log or console.warn", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    recordQabOrphanedToken({ negocioId: NEGOCIO_ID, externalId: NEGOCIO_ID, reason: "CONFIRMED_ORPHANED" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      recordQabOrphanedToken({ negocioId: NEGOCIO_ID, externalId: NEGOCIO_ID, reason: "PERSIST_FAILED" })
    ).toBeUndefined();
  });

  it("cannot leak a token even if one is smuggled into the arguments object", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const argsWithSmuggledToken = {
      negocioId: NEGOCIO_ID,
      externalId: NEGOCIO_ID,
      reason: "PERSIST_FAILED",
      token: "SUPER_SECRET_QAB_TOKEN_VALUE",
    } as unknown as Parameters<typeof recordQabOrphanedToken>[0];

    recordQabOrphanedToken(argsWithSmuggledToken);

    const loggedArgs = errorSpy.mock.calls.flat();
    expect(JSON.stringify(loggedArgs)).not.toContain("SUPER_SECRET_QAB_TOKEN_VALUE");
  });
});
