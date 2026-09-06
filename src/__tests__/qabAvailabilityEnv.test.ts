import { describe, it, expect } from "vitest";
import { qabAvailabilitySyncUrl } from "@/lib/qab/qabEnv";
import { QAB_AVAILABILITY_SYNC_PATH } from "@/constants/qab";

/**
 * F-007 — `qabAvailabilitySyncUrl` in `src/lib/qab/qabEnv.ts`. Pure: `resolveQabBaseUrl`
 * output + `QAB_AVAILABILITY_SYNC_PATH`. Kept in its own file, separate from the existing
 * `qabEnv.test.ts` (F-002, already green): a symbol this feature adds does not belong at
 * the top of a file whose other tests must keep passing while the implementer is still
 * writing this one (E-019).
 */

describe("qabAvailabilitySyncUrl", () => {
  it("should append QAB_AVAILABILITY_SYNC_PATH to the resolved origin", () => {
    expect(qabAvailabilitySyncUrl("https://queandabuscando.example")).toBe(
      `https://queandabuscando.example${QAB_AVAILABILITY_SYNC_PATH}`
    );
  });

  it("should not double a slash when concatenating", () => {
    const url = qabAvailabilitySyncUrl("https://queandabuscando.example");
    expect(url).not.toMatch(/\/\/api/);
  });

  it("should be a DIFFERENT path than the catalog sync route", async () => {
    const { qabCatalogSyncUrl } = await import("@/lib/qab/qabEnv");
    expect(qabAvailabilitySyncUrl("https://queandabuscando.example")).not.toBe(
      qabCatalogSyncUrl("https://queandabuscando.example")
    );
  });
});
