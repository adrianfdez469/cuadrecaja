import { describe, it, expect } from "vitest";
import {
  qabOrderIdSchema,
  compareQabOrderIds,
  maxQabOrderId,
  qabOrderStatusKnownSchema,
  qabOrderStatusSchema,
  isKnownQabOrderStatus,
  qabCancelledBySchema,
  isKnownQabCancelledBy,
} from "@/schemas/qabOrder";
import { QAB_ORDER_STATUSES, QAB_ORDER_CANCELLED_BY } from "@/constants/qab";

/**
 * F-001 — the primitives F-010 will build the order pull on.
 *
 * Two things justify this file existing at all:
 *
 *  1. QAB order ids are the decimal digits of a BIGINT. Comparing them as strings is wrong
 *     ("9" > "10" lexicographically) and comparing them as `Number` is wrong past 2^53, where
 *     JavaScript silently rounds. The contract mandates BigInt.
 *  2. The order status enum already grew from 6 to 9 values with no coexistence period and no
 *     HTTP error to warn about it (ADR 0004). So an unknown status must persist without breaking
 *     the pull, while still being distinguishable from a known one when deciding what to do.
 */

describe("qabOrderIdSchema", () => {
  const acceptedIds: Array<[string, string]> = [
    ["1", "1"],
    ["1001", "1001"],
    ["0", "0"],
    ["  1001  ", "1001"],
    ["9007199254740993", "9007199254740993"],
    ["9223372036854775807", "9223372036854775807"], // 19 digits: BIGINT max
  ];

  it.each(acceptedIds)("should accept the id %s and yield %s", (input, expected) => {
    expect(qabOrderIdSchema.parse(input)).toBe(expected);
  });

  const invalidIds: Array<[string, unknown]> = [
    ["an empty string", ""],
    ["a blank string", "   "],
    ["a negative id", "-1"],
    ["a decimal id", "1.0"],
    ["a non numeric id", "abc"],
    ["an id with 20 digits", "1".repeat(20)],
    ["scientific notation", "1e3"],
    ["an id with an inner space", "10 01"],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
    ["a boolean", true],
  ];

  it.each(invalidIds)("should reject %s", (_label, value) => {
    expect(qabOrderIdSchema.safeParse(value).success).toBe(false);
  });
});

describe("compareQabOrderIds", () => {
  it("should return -1 for compareQabOrderIds('9', '10'): ids are not compared as strings", () => {
    // The lexicographic trap. This single case is the reason the function exists.
    expect(compareQabOrderIds("9", "10")).toBe(-1);
  });

  it("should return 1 for compareQabOrderIds('10', '9')", () => {
    expect(compareQabOrderIds("10", "9")).toBe(1);
  });

  it("should return 1 beyond 2^53, where Number would lie", () => {
    // Number("9007199254740993") === Number("9007199254740992") === 9007199254740992.
    expect(compareQabOrderIds("9007199254740993", "9007199254740992")).toBe(1);
  });

  it("should return -1 beyond 2^53 in the opposite direction", () => {
    expect(compareQabOrderIds("9007199254740992", "9007199254740993")).toBe(-1);
  });

  it("should return 0 for two equal ids", () => {
    expect(compareQabOrderIds("9007199254740993", "9007199254740993")).toBe(0);
  });

  it("should compare the whole 19-digit BIGINT range", () => {
    expect(compareQabOrderIds("9223372036854775807", "9223372036854775806")).toBe(1);
  });

  it("should return only -1, 0 or 1", () => {
    expect([-1, 0, 1]).toContain(compareQabOrderIds("1", "1000000"));
    expect([-1, 0, 1]).toContain(compareQabOrderIds("1000000", "1"));
  });
});

describe("maxQabOrderId", () => {
  it("should return the candidate when there is no cursor yet", () => {
    expect(maxQabOrderId(null, "7")).toBe("7");
  });

  it("should keep the current cursor when the candidate is numerically smaller", () => {
    // "42" vs "7": a string comparison would wrongly move the cursor backwards.
    expect(maxQabOrderId("42", "7")).toBe("42");
  });

  it("should advance the cursor when the candidate is numerically greater", () => {
    expect(maxQabOrderId("7", "42")).toBe("42");
  });

  it("should be stable when both ids are equal", () => {
    expect(maxQabOrderId("7", "7")).toBe("7");
  });

  it("should advance the cursor beyond 2^53", () => {
    expect(maxQabOrderId("9007199254740992", "9007199254740993")).toBe("9007199254740993");
  });

  it("should not advance the cursor beyond 2^53 when the candidate is smaller", () => {
    expect(maxQabOrderId("9007199254740993", "9007199254740992")).toBe("9007199254740993");
  });
});

describe("QAB_ORDER_STATUSES", () => {
  it("should hold exactly the nine states of the contract (v5)", () => {
    expect([...QAB_ORDER_STATUSES]).toEqual([
      "PENDING",
      "PULLED",
      "CONFIRMED",
      "AWAITING_CUSTOMER",
      "READY",
      "IN_TRANSIT",
      "DELIVERED",
      "CANCELLED",
      "REJECTED_BY_STORE",
    ]);
  });
});

describe("isKnownQabOrderStatus", () => {
  it.each(QAB_ORDER_STATUSES.map((status) => [status] as const))(
    "should recognize %s as a known status",
    (status) => {
      expect(isKnownQabOrderStatus(status)).toBe(true);
    }
  );

  it("should NOT recognize 'FUTURO_DESCONOCIDO' as a known status", () => {
    expect(isKnownQabOrderStatus("FUTURO_DESCONOCIDO")).toBe(false);
  });

  it("should NOT recognize a lowercase known status", () => {
    expect(isKnownQabOrderStatus("pending")).toBe(false);
  });

  it("should NOT recognize an empty status", () => {
    expect(isKnownQabOrderStatus("")).toBe(false);
  });
});

describe("qabOrderStatusKnownSchema", () => {
  it.each(QAB_ORDER_STATUSES.map((status) => [status] as const))(
    "should accept the known status %s",
    (status) => {
      expect(qabOrderStatusKnownSchema.parse(status)).toBe(status);
    }
  );

  it("should reject an unknown status: it is what we consult when DECIDING", () => {
    expect(qabOrderStatusKnownSchema.safeParse("FUTURO_DESCONOCIDO").success).toBe(false);
  });
});

describe("qabOrderStatusSchema", () => {
  it("should accept 'FUTURO_DESCONOCIDO': an unknown status must never break the pull", () => {
    // Unit-level version of acceptance criterion 9: the column is text, not a Postgres enum.
    expect(qabOrderStatusSchema.parse("FUTURO_DESCONOCIDO")).toBe("FUTURO_DESCONOCIDO");
  });

  it("should accept a value that is unknown to the schema but rejected by isKnownQabOrderStatus", () => {
    const value = "FUTURO_DESCONOCIDO";

    expect(qabOrderStatusSchema.safeParse(value).success).toBe(true);
    expect(isKnownQabOrderStatus(value)).toBe(false);
  });

  it.each(QAB_ORDER_STATUSES.map((status) => [status] as const))(
    "should accept the known status %s",
    (status) => {
      expect(qabOrderStatusSchema.parse(status)).toBe(status);
    }
  );

  it("should trim the surrounding whitespace", () => {
    expect(qabOrderStatusSchema.parse("  PENDING  ")).toBe("PENDING");
  });

  it("should accept a status of exactly 64 characters", () => {
    const status = "A".repeat(64);
    expect(qabOrderStatusSchema.parse(status)).toBe(status);
  });

  const invalidStatuses: Array<[string, unknown]> = [
    ["an empty string", ""],
    ["a blank string", "   "],
    ["a status longer than 64 characters", "A".repeat(65)],
    ["null", null],
    ["undefined", undefined],
    ["a number", 1],
    ["an object", {}],
  ];

  it.each(invalidStatuses)("should reject %s", (_label, value) => {
    expect(qabOrderStatusSchema.safeParse(value).success).toBe(false);
  });
});

describe("qabCancelledBySchema", () => {
  it.each(QAB_ORDER_CANCELLED_BY.map((value) => [value] as const))(
    "should accept the known cancelledBy %s",
    (value) => {
      expect(qabCancelledBySchema.parse(value)).toBe(value);
    }
  );

  it("should accept null: cancelledBy is nullable", () => {
    expect(qabCancelledBySchema.parse(null)).toBeNull();
  });

  it("should accept an unknown cancelledBy: same tolerance as the status", () => {
    expect(qabCancelledBySchema.parse("FUTURO_DESCONOCIDO")).toBe("FUTURO_DESCONOCIDO");
  });

  const invalidCancelledBy: Array<[string, unknown]> = [
    ["a number", 1],
    ["an object", {}],
    ["a boolean", true],
  ];

  it.each(invalidCancelledBy)("should reject %s", (_label, value) => {
    expect(qabCancelledBySchema.safeParse(value).success).toBe(false);
  });
});

describe("isKnownQabCancelledBy", () => {
  it("should hold exactly the three values of the contract", () => {
    expect([...QAB_ORDER_CANCELLED_BY]).toEqual(["CUSTOMER", "EXPIRY", "STORE"]);
  });

  it.each(QAB_ORDER_CANCELLED_BY.map((value) => [value] as const))(
    "should recognize %s",
    (value) => {
      expect(isKnownQabCancelledBy(value)).toBe(true);
    }
  );

  it("should NOT recognize an unknown value", () => {
    expect(isKnownQabCancelledBy("FUTURO_DESCONOCIDO")).toBe(false);
  });

  it("should NOT recognize a lowercase known value", () => {
    expect(isKnownQabCancelledBy("customer")).toBe(false);
  });
});
