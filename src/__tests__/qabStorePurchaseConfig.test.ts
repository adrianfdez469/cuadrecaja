import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  isQabDeliveryFee,
  isQabOrderExpiryHours,
  isQabPurchaseConfigInconsistent,
  qabDeliveryFeeSchema,
  qabOrderExpiryHoursSchema,
  qabStorePurchaseConfigSchema,
  qabStorePurchaseConfigChangesSchema,
  qabPurchaseConfigIssueSchema,
} from "@/schemas/qabStorePurchaseConfig";
import {
  toQabDeliveryFee,
  toQabStorePurchaseConfig,
  collectQabStorePurchaseConfigChanges,
  type IQabStorePurchaseConfigRow,
} from "@/lib/qab/qabStorePurchaseConfig";
import type { IQabStorePurchaseConfig } from "@/schemas/qabStorePurchaseConfig";
import {
  QAB_CHECKOUT_MODES,
  QAB_DELIVERY_FEE_MODES,
  QAB_CHECKOUT_MODE_DEFAULT,
  QAB_DELIVERY_ENABLED_DEFAULT,
  QAB_DELIVERY_FEE_MODE_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_MIN,
  QAB_ORDER_EXPIRY_HOURS_MAX,
  QAB_DELIVERY_FEE_MAX_EXCLUSIVE,
  QAB_STORE_PURCHASE_CONFIG_KEYS,
  QAB_PURCHASE_CONFIG_ISSUE_CODES,
} from "@/constants/qab";

/**
 * F-016 — everything the contract's § 10 lists that does not belong in any of the six
 * files that already exist and grow with this feature: the two field predicates and the
 * three Zod schemas of `src/schemas/qabStorePurchaseConfig.ts`, the row <-> wire
 * conversions and the delta of `src/lib/qab/qabStorePurchaseConfig.ts`, and the F-016
 * constants of `src/constants/qab.ts`.
 *
 * Three traps the contract calls out explicitly (§ 0), so every describe block below
 * that touches them says which one it guards against:
 *
 *  - E-079: with `strict: false`, a `.nullable()` key inside an object collapses to
 *    "optional, `| null` gone" in the INFERRED TYPE. Every schema assertion below is a
 *    `.safeParse`/`.parse` call, never a type-level check.
 *  - E-008: two `Prisma.Decimal` instances holding the SAME amount must never look
 *    "changed" to `collectQabStorePurchaseConfigChanges` — `===` on the row would be the
 *    one comparison that fails this, so the delta is computed over the WIRE numbers.
 *  - The border between the 400 (all three contradictory keys present together) and the
 *    207 (the same contradiction, but only visible against the persisted row) is
 *    `isQabPurchaseConfigInconsistent` returning `false` for an ABSENT key, which is not
 *    the same thing as a `null` one.
 */

// `deliveryFee` is typed `number` in IQabStorePurchaseConfig (E-079: the exported schema is
// annotated explicitly, as `z.ZodType<number, unknown>`, to defeat the `strict: false`
// collapse), even though `null` is a reachable RUNTIME value for it (criterion 5). This helper
// widens just that one field back to `number | null` for the fixture's own convenience, and
// every value it produces is still cast to the contract's own declared type at the boundary.
type IConfigOverrides = Partial<Omit<IQabStorePurchaseConfig, "deliveryFee">> & {
  deliveryFee?: number | null;
};

function config(overrides: IConfigOverrides = {}): IQabStorePurchaseConfig {
  return {
    checkoutMode: QAB_CHECKOUT_MODE_DEFAULT,
    deliveryEnabled: QAB_DELIVERY_ENABLED_DEFAULT,
    deliveryFee: null,
    deliveryFeeMode: QAB_DELIVERY_FEE_MODE_DEFAULT,
    orderExpiryHours: QAB_ORDER_EXPIRY_HOURS_DEFAULT,
    ...overrides,
  } as IQabStorePurchaseConfig;
}

/* -------------------------------------------------------------------------- */
/* isQabDeliveryFee / isQabOrderExpiryHours — the border table of § 3, verbatim */
/* -------------------------------------------------------------------------- */

describe("isQabDeliveryFee / isQabOrderExpiryHours — contract § 3 border table", () => {
  const rows: Array<[string, unknown, boolean, boolean]> = [
    ["null", null, false, false],
    ["undefined", undefined, false, false],
    ['the string "12"', "12", false, false],
    ["NaN", NaN, false, false],
    ["Infinity", Infinity, false, false],
    ["0", 0, true, false],
    ["1", 1, true, true],
    ["12.34", 12.34, true, false],
    ["12.345 (three decimals)", 12.345, false, false],
    ["-1", -1, false, false],
    ["8760 (the max, inclusive)", 8760, true, true],
    ["8761 (one past the max)", 8761, true, false],
    ["999999999999.99 (the largest valid fee)", 999999999999.99, true, false],
    ["10 ** 12 (the exclusive fee ceiling)", 10 ** 12, false, false],
  ];

  it.each(rows)(
    "for %s, isQabDeliveryFee -> %s and isQabOrderExpiryHours -> %s",
    (_label, value, expectedFee, expectedHours) => {
      expect(isQabDeliveryFee(value)).toBe(expectedFee);
      expect(isQabOrderExpiryHours(value)).toBe(expectedHours);
    }
  );

  it("should keep QAB_DELIVERY_FEE_MAX_EXCLUSIVE at exactly 10 ** 12", () => {
    expect(QAB_DELIVERY_FEE_MAX_EXCLUSIVE).toBe(10 ** 12);
  });

  it("should keep the order-expiry range at [1, 8760] inclusive", () => {
    expect(QAB_ORDER_EXPIRY_HOURS_MIN).toBe(1);
    expect(QAB_ORDER_EXPIRY_HOURS_MAX).toBe(8760);
  });
});

/* -------------------------------------------------------------------------- */
/* isQabPurchaseConfigInconsistent — the 400/207 border                        */
/* -------------------------------------------------------------------------- */

describe("isQabPurchaseConfigInconsistent", () => {
  it("should be true when all three contradictory keys travel together: delivery on, flat rate, no amount", () => {
    expect(
      isQabPurchaseConfigInconsistent({
        deliveryEnabled: true,
        deliveryFeeMode: "FLAT_RATE",
        deliveryFee: null,
      })
    ).toBe(true);
  });

  it("should be false when deliveryEnabled is false — the discriminating control on that key", () => {
    expect(
      isQabPurchaseConfigInconsistent({
        deliveryEnabled: false,
        deliveryFeeMode: "FLAT_RATE",
        deliveryFee: null,
      })
    ).toBe(false);
  });

  it("should be false for QUOTED_PER_ORDER even with delivery on and no amount — the mode is the other one", () => {
    expect(
      isQabPurchaseConfigInconsistent({
        deliveryEnabled: true,
        deliveryFeeMode: "QUOTED_PER_ORDER",
        deliveryFee: null,
      })
    ).toBe(false);
  });

  it("should be false when there IS an amount — delivery on, flat rate, a real fee", () => {
    expect(
      isQabPurchaseConfigInconsistent({
        deliveryEnabled: true,
        deliveryFeeMode: "FLAT_RATE",
        deliveryFee: 100,
      })
    ).toBe(false);
  });

  it("should be false on the empty object — nothing to contradict", () => {
    expect(isQabPurchaseConfigInconsistent({})).toBe(false);
  });

  // This is THE border that separates the 400 (schema refine, all three present in one
  // payload) from the 207 (only visible against the row already stored in QAB): an ABSENT
  // key is not the same as a null/false one, because `undefined === null` is false and
  // `undefined === "FLAT_RATE"` is false too.
  it("should be false when deliveryFeeMode is ABSENT, even with deliveryEnabled true and deliveryFee null", () => {
    expect(
      isQabPurchaseConfigInconsistent({ deliveryEnabled: true, deliveryFee: null })
    ).toBe(false);
  });

  it("should be false when deliveryEnabled is ABSENT, even with deliveryFeeMode FLAT_RATE and deliveryFee null", () => {
    expect(
      isQabPurchaseConfigInconsistent({ deliveryFeeMode: "FLAT_RATE", deliveryFee: null })
    ).toBe(false);
  });

  it("should be false when deliveryFee is ABSENT (undefined) rather than null — this is the exact case a STORE event that only changes deliveryFee to null produces", () => {
    // A partial delta of { deliveryFee: null } alone (deliveryEnabled/deliveryFeeMode not
    // present) must NOT trip this predicate — that is what routes the contradiction to
    // QAB's 207 instead of a 400 raised by our own builder before it ever reaches the wire.
    expect(
      isQabPurchaseConfigInconsistent({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE" })
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The Zod schemas — parsed, never typed (E-079)                               */
/* -------------------------------------------------------------------------- */

describe("qabDeliveryFeeSchema", () => {
  it("should accept null (criterion 5: only deliveryFee is nullable)", () => {
    expect(qabDeliveryFeeSchema.safeParse(null).success).toBe(true);
  });

  it("should accept a well formed amount", () => {
    expect(qabDeliveryFeeSchema.safeParse(100).success).toBe(true);
  });

  it("should reject 12.345 — three decimals (criterion 6)", () => {
    expect(qabDeliveryFeeSchema.safeParse(12.345).success).toBe(false);
  });

  it("should reject a negative amount", () => {
    expect(qabDeliveryFeeSchema.safeParse(-1).success).toBe(false);
  });

  it("should reject undefined — omission is the payload's rule, not this field schema's", () => {
    expect(qabDeliveryFeeSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("qabOrderExpiryHoursSchema", () => {
  it("should reject null — orderExpiryHours is NOT nullable (criterion 5)", () => {
    expect(qabOrderExpiryHoursSchema.safeParse(null).success).toBe(false);
  });

  it("should reject 0 and 8761 — out of [1, 8760] (criterion 8)", () => {
    expect(qabOrderExpiryHoursSchema.safeParse(0).success).toBe(false);
    expect(qabOrderExpiryHoursSchema.safeParse(8761).success).toBe(false);
  });

  it("should accept the two range ends, 1 and 8760", () => {
    expect(qabOrderExpiryHoursSchema.safeParse(1).success).toBe(true);
    expect(qabOrderExpiryHoursSchema.safeParse(8760).success).toBe(true);
  });

  it("should reject a fractional value", () => {
    expect(qabOrderExpiryHoursSchema.safeParse(12.5).success).toBe(false);
  });
});

describe("qabStorePurchaseConfigSchema — the five together, STRICT", () => {
  const valid = config();

  it("should accept a well formed full configuration", () => {
    expect(qabStorePurchaseConfigSchema.safeParse(valid).success).toBe(true);
  });

  it.each(["checkoutMode", "deliveryEnabled", "deliveryFeeMode", "orderExpiryHours"] as const)(
    "should reject null in %s — only deliveryFee is nullable (criterion 5)",
    (field) => {
      expect(
        qabStorePurchaseConfigSchema.safeParse({ ...valid, [field]: null }).success
      ).toBe(false);
    }
  );

  it("should accept null in deliveryFee", () => {
    expect(
      qabStorePurchaseConfigSchema.safeParse({ ...valid, deliveryFee: null }).success
    ).toBe(false ? undefined : true);
  });

  it("should reject an extra key (.strict())", () => {
    expect(
      qabStorePurchaseConfigSchema.safeParse({ ...valid, zoneCode: "HAVANA" }).success
    ).toBe(false);
  });

  it("should reject an out-of-vocabulary checkoutMode", () => {
    expect(
      qabStorePurchaseConfigSchema.safeParse({ ...valid, checkoutMode: "PHONE" }).success
    ).toBe(false);
  });

  it("should reject ZONE_BASED as a deliveryFeeMode — it does not exist yet in this feature", () => {
    expect(
      qabStorePurchaseConfigSchema.safeParse({ ...valid, deliveryFeeMode: "ZONE_BASED" }).success
    ).toBe(false);
  });
});

describe("qabStorePurchaseConfigChangesSchema — .partial() of the same five", () => {
  it("should accept an empty object — no change at all", () => {
    expect(qabStorePurchaseConfigChangesSchema.safeParse({}).success).toBe(true);
  });

  it("should accept a single changed key on its own", () => {
    expect(
      qabStorePurchaseConfigChangesSchema.safeParse({ orderExpiryHours: 48 }).success
    ).toBe(true);
  });

  it("should accept deliveryFee: null on its own — the exact shape of a STORE event that only clears the fee", () => {
    expect(
      qabStorePurchaseConfigChangesSchema.safeParse({ deliveryFee: null }).success
    ).toBe(true);
  });

  it("should still reject an extra, unknown key — .partial() does not lift .strict()", () => {
    expect(
      qabStorePurchaseConfigChangesSchema.safeParse({ zoneCode: "HAVANA" }).success
    ).toBe(false);
  });

  it("should still reject a present-but-invalid value for a key it does carry", () => {
    expect(
      qabStorePurchaseConfigChangesSchema.safeParse({ checkoutMode: "PHONE" }).success
    ).toBe(false);
  });
});

describe("qabPurchaseConfigIssueSchema", () => {
  it("should accept a well formed issue", () => {
    expect(
      qabPurchaseConfigIssueSchema.safeParse({
        code: "DELIVERY_FEE_NEGATIVE",
        field: "deliveryFee",
      }).success
    ).toBe(true);
  });

  it("should reject a code outside the closed vocabulary", () => {
    expect(
      qabPurchaseConfigIssueSchema.safeParse({ code: "SOMETHING_ELSE", field: "deliveryFee" })
        .success
    ).toBe(false);
  });

  it("should reject a field that is not one of the five keys", () => {
    expect(
      qabPurchaseConfigIssueSchema.safeParse({
        code: "DELIVERY_FEE_NEGATIVE",
        field: "zoneCode",
      }).success
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* toQabDeliveryFee / toQabStorePurchaseConfig — row -> wire, tolerant on read  */
/* -------------------------------------------------------------------------- */

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function row(overrides: Partial<IQabStorePurchaseConfigRow> = {}): IQabStorePurchaseConfigRow {
  return {
    checkoutMode: QAB_CHECKOUT_MODE_DEFAULT,
    deliveryEnabled: QAB_DELIVERY_ENABLED_DEFAULT,
    deliveryFee: null,
    deliveryFeeMode: QAB_DELIVERY_FEE_MODE_DEFAULT,
    orderExpiryHours: QAB_ORDER_EXPIRY_HOURS_DEFAULT,
    ...overrides,
  } as IQabStorePurchaseConfigRow;
}

describe("toQabDeliveryFee", () => {
  it("should convert a Prisma.Decimal to a plain wire number", () => {
    expect(toQabDeliveryFee(decimal("500.00"))).toBe(500);
  });

  it("should return null for null", () => {
    expect(toQabDeliveryFee(null)).toBeNull();
  });

  it("should return null for undefined too (E-079: the three reachable shapes)", () => {
    // Not expressible in the declared signature, but the contract is explicit that this
    // function returns null for undefined AS WELL as null — `value == null` reachable input.
    expect(toQabDeliveryFee(undefined as unknown as null)).toBeNull();
  });

  it("should accept a plain number without punishing a caller that already converted", () => {
    expect(toQabDeliveryFee(123.45)).toBe(123.45);
  });
});

describe("toQabStorePurchaseConfig — row projection, tolerant on read", () => {
  it("should project a well formed row through unchanged", () => {
    const result = toQabStorePurchaseConfig(
      row({
        checkoutMode: "ONSITE",
        deliveryEnabled: true,
        deliveryFee: decimal("150.00") as unknown as IQabStorePurchaseConfigRow["deliveryFee"],
        deliveryFeeMode: "QUOTED_PER_ORDER",
        orderExpiryHours: 48,
      })
    );

    expect(result).toEqual({
      checkoutMode: "ONSITE",
      deliveryEnabled: true,
      deliveryFee: 150,
      deliveryFeeMode: "QUOTED_PER_ORDER",
      orderExpiryHours: 48,
    });
  });

  it("should read a checkoutMode outside the vocabulary as the DEFAULT, not throw", () => {
    const result = toQabStorePurchaseConfig(
      row({ checkoutMode: "SOMETHING_A_HAND_WRITTEN_SQL_INSERT_LEFT_BEHIND" })
    );
    expect(result.checkoutMode).toBe(QAB_CHECKOUT_MODE_DEFAULT);
  });

  it("should read a deliveryFeeMode outside the vocabulary as the DEFAULT", () => {
    const result = toQabStorePurchaseConfig(row({ deliveryFeeMode: "ZONE_BASED" }));
    expect(result.deliveryFeeMode).toBe(QAB_DELIVERY_FEE_MODE_DEFAULT);
  });

  it("should read an out-of-range orderExpiryHours as the DEFAULT", () => {
    expect(toQabStorePurchaseConfig(row({ orderExpiryHours: 0 })).orderExpiryHours).toBe(
      QAB_ORDER_EXPIRY_HOURS_DEFAULT
    );
    expect(toQabStorePurchaseConfig(row({ orderExpiryHours: 100000 })).orderExpiryHours).toBe(
      QAB_ORDER_EXPIRY_HOURS_DEFAULT
    );
  });
});

/* -------------------------------------------------------------------------- */
/* collectQabStorePurchaseConfigChanges — the delta, and the E-008 guard       */
/* -------------------------------------------------------------------------- */

describe("collectQabStorePurchaseConfigChanges", () => {
  it("should return an empty object (Object.keys length 0) when nothing changed", () => {
    const same = config();
    const changes = collectQabStorePurchaseConfigChanges(same, { ...same });
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it("should return EXACTLY the one key that changed, carrying the value from `after`", () => {
    const before = config({ orderExpiryHours: 24 });
    const after = config({ orderExpiryHours: 48 });

    const changes = collectQabStorePurchaseConfigChanges(before, after);

    expect(Object.keys(changes)).toEqual(["orderExpiryHours"]);
    expect(changes.orderExpiryHours).toBe(48);
  });

  it("should carry deliveryFee: null through when the amount changed FROM a number TO null", () => {
    const before = config({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE", deliveryFee: 100 });
    const after = config({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE", deliveryFee: null });

    const changes = collectQabStorePurchaseConfigChanges(before, after);

    expect(Object.keys(changes)).toEqual(["deliveryFee"]);
    expect(changes.deliveryFee).toBeNull();
  });

  it("should report every one of the five keys that changed when all five did, each with its `after` value", () => {
    const before = config();
    const after = config({
      checkoutMode: "ONSITE",
      deliveryEnabled: true,
      deliveryFee: 200,
      deliveryFeeMode: "QUOTED_PER_ORDER",
      orderExpiryHours: 72,
    });

    const changes = collectQabStorePurchaseConfigChanges(before, after);

    expect(Object.keys(changes).sort()).toEqual(QAB_STORE_PURCHASE_CONFIG_KEYS.slice().sort());
    expect(changes).toEqual(after);
  });

  // E-008: the whole reason this function works over the WIRE shape (`number`) and not over
  // the ROW shape (`Prisma.Decimal`). Two Decimal INSTANCES holding the same amount are two
  // different objects, so `===` on them is always false — which, applied straight to the row,
  // would put `deliveryFee` in every single delta this feature ever produces.
  it("E-008: two DIFFERENT Prisma.Decimal instances holding the SAME amount must produce NO key at all", () => {
    const beforeRow = toQabStorePurchaseConfig(
      row({ deliveryFee: decimal("500.00") as unknown as IQabStorePurchaseConfigRow["deliveryFee"] })
    );
    const afterRow = toQabStorePurchaseConfig(
      row({ deliveryFee: decimal("500.00") as unknown as IQabStorePurchaseConfigRow["deliveryFee"] })
    );

    // Sanity check on the fixture itself: these really are two distinct object instances.
    expect(beforeRow).not.toBe(afterRow);

    const changes = collectQabStorePurchaseConfigChanges(beforeRow, afterRow);
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it("should never hold a key whose value is undefined, even if a caller's `after` carried one", () => {
    const before = config();
    // `as never` on purpose: this simulates a caller that violates the type but still reaches
    // the function at runtime, which is exactly the shape `Object.keys` (not a value check)
    // guards against.
    const after = { ...config(), checkoutMode: undefined } as never;

    const changes = collectQabStorePurchaseConfigChanges(before, after);
    expect(Object.keys(changes)).not.toContain("checkoutMode");
  });
});

/* -------------------------------------------------------------------------- */
/* Constants — src/constants/qab.ts, F-016 section                            */
/* -------------------------------------------------------------------------- */

describe("F-016 constants (src/constants/qab.ts)", () => {
  it("should keep QAB_STORE_PURCHASE_CONFIG_KEYS as exactly the five, in wire order", () => {
    expect(QAB_STORE_PURCHASE_CONFIG_KEYS).toEqual([
      "checkoutMode",
      "deliveryEnabled",
      "deliveryFee",
      "deliveryFeeMode",
      "orderExpiryHours",
    ]);
  });

  it("should keep QAB_CHECKOUT_MODES to exactly WHATSAPP and ONSITE", () => {
    expect(QAB_CHECKOUT_MODES).toEqual(["WHATSAPP", "ONSITE"]);
  });

  it("should keep QAB_DELIVERY_FEE_MODES to EXACTLY two values, and NOT contain ZONE_BASED (F-042 scope)", () => {
    expect(QAB_DELIVERY_FEE_MODES).toHaveLength(2);
    expect(QAB_DELIVERY_FEE_MODES).toEqual(["FLAT_RATE", "QUOTED_PER_ORDER"]);
    expect(QAB_DELIVERY_FEE_MODES).not.toContain("ZONE_BASED");
  });

  it("should keep the four defaults matching the Prisma column @default's (ADR ADRIAN-0151 (e))", () => {
    expect(QAB_CHECKOUT_MODE_DEFAULT).toBe("WHATSAPP");
    expect(QAB_DELIVERY_ENABLED_DEFAULT).toBe(false);
    expect(QAB_DELIVERY_FEE_MODE_DEFAULT).toBe("FLAT_RATE");
    expect(QAB_ORDER_EXPIRY_HOURS_DEFAULT).toBe(24);
  });

  it("should list every code QAB_PURCHASE_CONFIG_ISSUE_CODES declares, DELIVERY_CONFIG_INCONSISTENT included", () => {
    expect(QAB_PURCHASE_CONFIG_ISSUE_CODES).toEqual([
      "DELIVERY_FEE_NOT_A_NUMBER",
      "DELIVERY_FEE_NEGATIVE",
      "DELIVERY_FEE_TOO_MANY_DECIMALS",
      "DELIVERY_FEE_TOO_LARGE",
      "ORDER_EXPIRY_HOURS_NOT_AN_INTEGER",
      "ORDER_EXPIRY_HOURS_OUT_OF_RANGE",
      "DELIVERY_CONFIG_INCONSISTENT",
    ]);
  });
});
