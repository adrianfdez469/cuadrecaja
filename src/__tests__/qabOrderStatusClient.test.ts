import { describe, it, expect } from "vitest";
import {
  qabOrderStatusFailureCode,
  isQabOrderStatusRetryable,
} from "@/lib/qab/qabOrderStatusClient";
import {
  QAB_ORDER_STATUS_FAILURE_CODES,
  QAB_ORDER_STATUS_RETRYABLE_CODES,
} from "@/constants/qab";

/**
 * F-012 — `src/lib/qab/qabOrderStatusClient.ts` (contract § 3, ADR 0064 §§ 2 and 4).
 * Both functions here are PURE and total.
 *
 * `postQabOrderStatus` is deliberately NOT tested in this file: contract § 8.4 puts it
 * outside the suite (it needs a real `fetch`/network round trip against QAB or a
 * capture server), and that is the `qa` agent's job, not this one's.
 *
 * The expectation tables are hard-coded from ADR 0064 § 2 and § 4, not derived from
 * QAB_ORDER_STATUS_FAILURE_CODES / QAB_ORDER_STATUS_RETRYABLE_CODES: re-deriving the
 * expectation from the very constants the implementation reads would let a wrong
 * constant and a wrong function agree with each other and both look green.
 */

describe("qabOrderStatusFailureCode — ADR 0064 § 2, the six rows and the default", () => {
  it("maps 400 to INVALID_BODY", () => {
    expect(qabOrderStatusFailureCode(400)).toBe("INVALID_BODY");
  });

  it("maps 401 to UNAUTHORIZED", () => {
    expect(qabOrderStatusFailureCode(401)).toBe("UNAUTHORIZED");
  });

  it("maps 403 to BUSINESS_INACTIVE", () => {
    expect(qabOrderStatusFailureCode(403)).toBe("BUSINESS_INACTIVE");
  });

  it("maps 404 to UNKNOWN_ORDER", () => {
    expect(qabOrderStatusFailureCode(404)).toBe("UNKNOWN_ORDER");
  });

  it("maps 409 to ORDER_DELIVERY_NOT_QUOTED — criterion 4's upstream trigger", () => {
    expect(qabOrderStatusFailureCode(409)).toBe("ORDER_DELIVERY_NOT_QUOTED");
  });

  it("maps 503 to SYNC_NOT_CONFIGURED", () => {
    expect(qabOrderStatusFailureCode(503)).toBe("SYNC_NOT_CONFIGURED");
  });

  it.each([418, 500, 999, 301])(
    "maps an undocumented status (%d) to UNEXPECTED_STATUS — total, never throws",
    (status) => {
      expect(() => qabOrderStatusFailureCode(status)).not.toThrow();
      expect(qabOrderStatusFailureCode(status)).toBe("UNEXPECTED_STATUS");
    },
  );

  it("maps 200 to UNEXPECTED_STATUS too — this function is never called with it, but must not throw if it were", () => {
    expect(() => qabOrderStatusFailureCode(200)).not.toThrow();
    expect(qabOrderStatusFailureCode(200)).toBe("UNEXPECTED_STATUS");
  });
});

describe("isQabOrderStatusRetryable — ADR 0064 § 4", () => {
  it("ORDER_DELIVERY_NOT_QUOTED is NEVER retryable — acceptance criterion 4 in its most literal form", () => {
    expect(isQabOrderStatusRetryable("ORDER_DELIVERY_NOT_QUOTED")).toBe(false);
  });

  it.each([
    ["TRANSPORT", true],
    ["INVALID_RESPONSE_BODY", true],
    ["UNEXPECTED_STATUS", true],
    ["NOT_CONFIGURED", false],
    ["INVALID_BODY", false],
    ["UNAUTHORIZED", false],
    ["BUSINESS_INACTIVE", false],
    ["UNKNOWN_ORDER", false],
    ["ORDER_DELIVERY_NOT_QUOTED", false],
    ["SYNC_NOT_CONFIGURED", false],
  ] as const)("%s is retryable: %s", (code, expected) => {
    expect(isQabOrderStatusRetryable(code)).toBe(expected);
  });

  it("agrees with QAB_ORDER_STATUS_RETRYABLE_CODES for every code in QAB_ORDER_STATUS_FAILURE_CODES — the same question is not answered twice (E-014)", () => {
    const failureCodes: readonly string[] = QAB_ORDER_STATUS_FAILURE_CODES ?? [];
    const retryableCodes: readonly string[] = QAB_ORDER_STATUS_RETRYABLE_CODES ?? [];

    for (const code of failureCodes) {
      expect(isQabOrderStatusRetryable(code as never)).toBe(
        retryableCodes.includes(code),
      );
    }
  });
});
