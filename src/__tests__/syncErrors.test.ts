import { describe, it, expect } from "vitest";
import { isPermanentSyncError } from "@/app/pos/utils/syncErrors";

describe("isPermanentSyncError", () => {
  it.each([400, 401, 403, 404, 409, 422])(
    "parks the sale on HTTP %s",
    (status) => {
      expect(isPermanentSyncError({ response: { status } })).toBe(true);
    },
  );

  it.each([408, 429])("keeps retrying on HTTP %s", (status) => {
    expect(isPermanentSyncError({ response: { status } })).toBe(false);
  });

  it.each([500, 502, 503, 504])(
    "keeps retrying on HTTP %s — that is what the offline queue is for",
    (status) => {
      expect(isPermanentSyncError({ response: { status } })).toBe(false);
    },
  );

  it("keeps retrying a network failure with no response at all", () => {
    expect(isPermanentSyncError(new Error("Network Error"))).toBe(false);
    expect(isPermanentSyncError({ response: undefined })).toBe(false);
  });

  it("does not throw on null or undefined", () => {
    expect(isPermanentSyncError(null)).toBe(false);
    expect(isPermanentSyncError(undefined)).toBe(false);
  });

  it("ignores a non-numeric status", () => {
    expect(isPermanentSyncError({ response: { status: "400" } })).toBe(false);
  });
});
