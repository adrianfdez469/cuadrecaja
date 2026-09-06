import { describe, it, expect } from "vitest";
import {
  offerOrderStatusTransitions,
  orderStatusDivergedLogLine,
  orderStatusWriteFailureCause,
} from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import { QAB_ORDER_STATUSES, QAB_ORDER_STATUS_REPORTABLE } from "@/constants/qab";
import { TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE } from "@/constants/tiendaOnline";

/**
 * F-012 — `src/lib/tiendaOnline/tiendaOnlineOrderStatus.ts` (contract § 4, ADR 0065).
 * PURE: no Prisma, no React, `.ts` and not `.tsx` on purpose so this file can import it
 * at all (E-015).
 *
 * The expectation table below is copied from the contract's own frozen rule ("The
 * rules, and there are no others — E-032"), not derived from QAB_ORDER_STATUS_SEQUENCE
 * or QAB_ORDER_STATUS_REPORTABLE: re-deriving the expectation from the very constants
 * the implementation reads would let a wrong constant and a wrong function agree with
 * each other and both look green.
 */

const TERMINAL = ["DELIVERED", "CANCELLED", "REJECTED_BY_STORE"] as const;

const NON_TERMINAL_TABLE = [
  {
    origin: "PULLED",
    targets: [
      "CONFIRMED",
      "READY",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
      "REJECTED_BY_STORE",
    ],
  },
  {
    origin: "CONFIRMED",
    targets: ["READY", "IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED_BY_STORE"],
  },
  {
    origin: "READY",
    targets: ["IN_TRANSIT", "DELIVERED", "CANCELLED", "REJECTED_BY_STORE"],
  },
  {
    origin: "IN_TRANSIT",
    targets: ["DELIVERED", "CANCELLED", "REJECTED_BY_STORE"],
  },
] as const;

describe("QAB_ORDER_STATUS_REPORTABLE — exact six values, in this order (design § 4.3 selector depends on it)", () => {
  it("is exactly CONFIRMED, READY, IN_TRANSIT, DELIVERED, CANCELLED, REJECTED_BY_STORE, in that order", () => {
    expect(QAB_ORDER_STATUS_REPORTABLE).toEqual([
      "CONFIRMED",
      "READY",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
      "REJECTED_BY_STORE",
    ]);
  });
});

describe("offerOrderStatusTransitions", () => {
  it.each(NON_TERMINAL_TABLE)(
    "from $origin: offers exactly the forward targets, in sequence, then CANCELLED, then REJECTED_BY_STORE",
    ({ origin, targets }) => {
      const result = offerOrderStatusTransitions(origin);

      expect(result.targets).toEqual([...targets]);
      expect(result.blocked).toBeNull();
    },
  );

  it.each(TERMINAL)(
    "from a terminal status (%s): no targets, blocked TERMINAL",
    (origin) => {
      const result = offerOrderStatusTransitions(origin);

      expect(result.targets).toEqual([]);
      expect(result.blocked).toBe("TERMINAL");
    },
  );

  it("from AWAITING_CUSTOMER: no targets, blocked AWAITING_CUSTOMER — it is not in the sequence at all (criterion 14)", () => {
    const result = offerOrderStatusTransitions("AWAITING_CUSTOMER");

    expect(result.targets).toEqual([]);
    expect(result.blocked).toBe("AWAITING_CUSTOMER");
  });

  it("from PENDING: no targets, blocked UNKNOWN_STATUS — a value QAB owns that is nevertheless not on the sequence", () => {
    const result = offerOrderStatusTransitions("PENDING");

    expect(result.targets).toEqual([]);
    expect(result.blocked).toBe("UNKNOWN_STATUS");
  });

  it("from an invented status QAB never published: never throws, no targets, blocked UNKNOWN_STATUS (ADR 0004 — status is open text)", () => {
    expect(() => offerOrderStatusTransitions("READY_FOR_PICKUP")).not.toThrow();

    const result = offerOrderStatusTransitions("READY_FOR_PICKUP");
    expect(result.targets).toEqual([]);
    expect(result.blocked).toBe("UNKNOWN_STATUS");
  });

  it("from an empty string: does not throw, and offers nothing", () => {
    expect(() => offerOrderStatusTransitions("")).not.toThrow();
    expect(offerOrderStatusTransitions("").targets).toEqual([]);
  });

  it("the invariant holds for every published status plus one invented one: blocked === null iff targets is non-empty", () => {
    const sample: string[] = [...QAB_ORDER_STATUSES, "READY_FOR_PICKUP", ""];

    for (const status of sample) {
      const { targets, blocked } = offerOrderStatusTransitions(status);
      expect(blocked === null).toBe(targets.length > 0);
    }
  });

  it("AWAITING_CUSTOMER never appears in targets, from any origin whatsoever — criterion 13", () => {
    const sample: string[] = [...QAB_ORDER_STATUSES, "READY_FOR_PICKUP"];

    for (const status of sample) {
      expect(offerOrderStatusTransitions(status).targets).not.toContain(
        "AWAITING_CUSTOMER",
      );
    }
  });

  it("no target is ever earlier in the sequence than the origin — skipping forward is allowed, going back is not", () => {
    const SEQUENCE = ["PULLED", "CONFIRMED", "READY", "IN_TRANSIT", "DELIVERED"];

    for (const { origin } of NON_TERMINAL_TABLE) {
      const originIndex = SEQUENCE.indexOf(origin);
      const { targets } = offerOrderStatusTransitions(origin);

      for (const target of targets) {
        const targetIndex = SEQUENCE.indexOf(target);
        // CANCELLED / REJECTED_BY_STORE are not on the sequence at all (-1): they
        // are the two extras, always allowed, never "earlier".
        if (targetIndex !== -1) {
          expect(targetIndex).toBeGreaterThan(originIndex);
        }
      }
    }
  });
});

describe("orderStatusDivergedLogLine", () => {
  it("contains the pedidoId it was given, verbatim", () => {
    const line = orderStatusDivergedLogLine({
      pedidoId: "PEDIDO-MARKER-711e",
      status: "CONFIRMED",
      cause: "P2025",
    });

    expect(line).toContain("PEDIDO-MARKER-711e");
  });

  it("contains the status and the cause it was given", () => {
    const line = orderStatusDivergedLogLine({
      pedidoId: "22222222-2222-2222-2222-222222222222",
      status: "DELIVERED",
      cause: "NOT_WRITTEN",
    });

    expect(line).toContain("DELIVERED");
    expect(line).toContain("NOT_WRITTEN");
  });

  it("never cites a value smuggled through any other path — its signature admits none (criterion 9/11, E-031)", () => {
    // The signature takes exactly {pedidoId, status, cause}. This simulates a caller
    // that bypasses that at runtime — the type system already forbids it at compile
    // time — which is exactly the scenario E-031 exists to guard against: a value
    // that should never travel with this line must not leak even if handed to it.
    const line = orderStatusDivergedLogLine({
      pedidoId: "22222222-2222-2222-2222-222222222222",
      status: "CONFIRMED",
      cause: "P2025",
      qabOrderId: "9007199254740993",
      code: "ORD-SECRET-0001",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(line).not.toContain("9007199254740993");
    expect(line).not.toContain("ORD-SECRET-0001");
  });
});

describe("orderStatusWriteFailureCause", () => {
  it("returns the thrown value's code when it matches the pattern (a Prisma P2025-style code)", () => {
    expect(orderStatusWriteFailureCause({ code: "P2025" })).toBe("P2025");
  });

  it("accepts a 16-character code (the upper bound) verbatim", () => {
    const code = "A".repeat(16);
    expect(orderStatusWriteFailureCause({ code })).toBe(code);
  });

  it("falls back to UNKNOWN for a 17-character code — one past the bound", () => {
    const code = "A".repeat(17);
    expect(orderStatusWriteFailureCause({ code })).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("falls back to UNKNOWN for a lower-case code — the pattern is [A-Z0-9_] only", () => {
    expect(orderStatusWriteFailureCause({ code: "p2025" })).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("falls back to UNKNOWN for a code containing a hyphen", () => {
    expect(orderStatusWriteFailureCause({ code: "P2025-X" })).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("falls back to UNKNOWN for a non-string code", () => {
    expect(orderStatusWriteFailureCause({ code: 2025 })).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("falls back to UNKNOWN for a plain Error with no code at all", () => {
    expect(orderStatusWriteFailureCause(new Error("boom"))).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("falls back to UNKNOWN for a thrown non-object value", () => {
    expect(orderStatusWriteFailureCause("some string throw")).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
    expect(orderStatusWriteFailureCause(null)).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
    expect(orderStatusWriteFailureCause(undefined)).toBe(
      TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE,
    );
  });

  it("never reads .message — a matching code wins even when the message carries a marker (E-031)", () => {
    const result = orderStatusWriteFailureCause({
      code: "P2025",
      message: "MARKER_THAT_MUST_NOT_LEAK some driver detail",
    });

    expect(result).toBe("P2025");
    expect(result).not.toContain("MARKER_THAT_MUST_NOT_LEAK");
  });

  it("never falls back to .message either — an unmatched code still returns UNKNOWN, not the message text", () => {
    const result = orderStatusWriteFailureCause({
      code: "not-a-valid-code",
      message: "MARKER_THAT_MUST_NOT_LEAK some driver detail",
    });

    expect(result).toBe(TIENDA_ONLINE_ORDER_STATUS_UNKNOWN_CAUSE);
    expect(result).not.toContain("MARKER_THAT_MUST_NOT_LEAK");
  });
});
