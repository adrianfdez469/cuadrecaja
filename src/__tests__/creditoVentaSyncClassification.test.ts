import { describe, it, expect } from "vitest";
import { isPermanentSyncError } from "@/app/pos/utils/syncErrors";
import { RETRYABLE_CLIENT_ERROR_STATUSES } from "@/constants/pos";

/**
 * F-032, contract § 5.6, § 8, § 9.1 — criterion 6, the half that is verifiable with NO
 * database at all.
 *
 * These two symbols are NOT new and NOT modified by F-032 (contract § 1: neither
 * `src/app/pos/utils/syncErrors.ts` nor `src/constants/pos.ts` is in the implementer's
 * write list). They are imported statically on purpose: unlike the feature's own new
 * modules, there is nothing here that could still be missing while the implementer
 * works, so E-019's dynamic-import defense does not apply.
 *
 * This is the control that stops someone from "fixing"
 * `RETRYABLE_CLIENT_ERROR_STATUSES` later in a way that would leave a credit sale
 * spinning forever instead of parking with its CREDIT_WITHOUT_CUSTOMER /
 * CREDIT_CUSTOMER_CONFLICT 409.
 */
describe("409 is classified as permanent, not retried forever (criterion 6)", () => {
  it("RETRYABLE_CLIENT_ERROR_STATUSES does not contain 409", () => {
    expect(RETRYABLE_CLIENT_ERROR_STATUSES).not.toContain(409);
  });

  it("isPermanentSyncError({ response: { status: 409 } }) is true", () => {
    expect(isPermanentSyncError({ response: { status: 409 } })).toBe(true);
  });

  it("RETRYABLE_CLIENT_ERROR_STATUSES is still exactly [408, 429] — unchanged by this feature", () => {
    expect(RETRYABLE_CLIENT_ERROR_STATUSES).toEqual([408, 429]);
  });

  it("a genuinely retryable status (429) stays classified as NOT permanent — the two rules must not collide", () => {
    expect(isPermanentSyncError({ response: { status: 429 } })).toBe(false);
  });
});
