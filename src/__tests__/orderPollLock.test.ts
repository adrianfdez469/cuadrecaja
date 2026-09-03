import { describe, it, expect } from "vitest";
import { qabOrderPollLockKey } from "@/lib/qab/orderPollLock";

/**
 * F-002 — `qabOrderPollLockKey`, golden vectors from the interface contract (measured,
 * not assumed — see ADR 0009). This is the only piece of the pull's mutual-exclusion
 * lock that is a pure function: `withQabOrderPollLock` itself needs a real Postgres
 * connection (`pg_try_advisory_xact_lock`) and is out of this suite's reach — verified by
 * `qa` executing. If this file ever goes red, the key derivation drifted, and two order
 * pollers of the same business can now run at once without anyone noticing until a
 * duplicate order shows up on the POS side.
 */
describe("qabOrderPollLockKey", () => {
  it.each([
    ["1c2d3e4f-0000-4000-8000-000000000001", BigInt("2997154240146755440")],
    ["1c2d3e4f-0000-4000-8000-000000000002", BigInt("8956557968866210348")],
    ["negocio-1", BigInt("-8598157114941140293")],
  ])("should derive the contract's golden key for %s", (negocioId, expected) => {
    expect(qabOrderPollLockKey(negocioId)).toBe(expected);
  });

  it("should return a bigint, never a number: the key can exceed Number.MAX_SAFE_INTEGER and can be negative", () => {
    expect(typeof qabOrderPollLockKey("any-negocio-id")).toBe("bigint");
  });

  it("should be deterministic: the same negocioId always yields the same key", () => {
    expect(qabOrderPollLockKey("negocio-repetido")).toBe(qabOrderPollLockKey("negocio-repetido"));
  });

  it("should give different negocioIds different keys in these cases (no observed collision)", () => {
    expect(qabOrderPollLockKey("negocio-a")).not.toBe(qabOrderPollLockKey("negocio-b"));
  });
});
