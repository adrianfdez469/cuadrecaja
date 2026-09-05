import { describe, it, expect } from "vitest";
import {
  isZeroAmount,
  presentTiendaOnlineDelivery,
  normalizeUnknownCode,
  orderStatusPresentation,
  cancelledByLabel,
  formatOrderAmount,
  formatOrderQuantity,
  unattendedCountLabel,
  unassignedTitle,
  conversionMismatchTitle,
  lineCountLabel,
  productsSectionLabel,
  formatOrderDateShort,
  formatOrderDateLong,
  formatOrderTime,
  rateSnapshotProvenance,
  orderStatusFailureCopy,
  orderStatusConfirmTitle,
  orderStatusAppliedNotice,
  orderStatusDivergedNotice,
} from "@/components/tiendaOnline/orderPresentation";
import { TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH } from "@/constants/tiendaOnline";
import { QAB_ORDER_STATUSES, QAB_ORDER_CANCELLED_BY } from "@/constants/qab";
import type { ITiendaOnlineOrderAmounts } from "@/schemas/tiendaOnline";

/**
 * F-011 — `src/components/tiendaOnline/orderPresentation.ts` (contract § 6). A `.ts`, not
 * a `.tsx`, precisely so this file can import it at all (E-015): `vitest.config.ts` does
 * not override `jsx: "preserve"`, so ANY `.tsx` — even one holding a pure function —
 * fails to parse in the test environment.
 *
 * Per contract § 9.4, what is pinned here is the FORM, never a literal sentence: that the
 * two written forms of a count differ and the singular one does not print the plural;
 * that an unknown code comes back normalized and truncated, not as a generic label; that
 * `formatOrderAmount` keeps both decimals and the sign of the input string; that an
 * unparseable date is never printed raw. The exact Spanish wording is the design
 * contract's (`.agents/designs/F-011.md`) to fix and to verify in the browser (E-016).
 */

describe("isZeroAmount", () => {
  it("should be true for a fixed-scale zero, sign included", () => {
    expect(isZeroAmount("0.00")).toBe(true);
    expect(isZeroAmount("-0.00")).toBe(true);
  });

  it("should be false for any non-zero amount, positive or negative", () => {
    expect(isZeroAmount("0.01")).toBe(false);
    expect(isZeroAmount("-0.01")).toBe(false);
  });
});

describe("presentTiendaOnlineDelivery — criterion 4 (ADR 0059)", () => {
  it('is PENDING_QUOTE whenever amounts.kind says so, regardless of any other value', () => {
    const pending: ITiendaOnlineOrderAmounts = {
      kind: "PENDING_QUOTE",
      subtotal: "100.00",
      discountTotal: "0.00",
      partialTotal: "100.00",
    };

    expect(presentTiendaOnlineDelivery(pending)).toBe("PENDING_QUOTE");
  });

  it("is FREE when quoted and deliveryFee is zero", () => {
    const quotedFree: ITiendaOnlineOrderAmounts = {
      kind: "QUOTED",
      subtotal: "100.00",
      discountTotal: "0.00",
      deliveryFee: "0.00",
      total: "100.00",
    };

    expect(presentTiendaOnlineDelivery(quotedFree)).toBe("FREE");
  });

  it("is CHARGED when quoted and deliveryFee is not zero", () => {
    const quotedCharged: ITiendaOnlineOrderAmounts = {
      kind: "QUOTED",
      subtotal: "100.00",
      discountTotal: "0.00",
      deliveryFee: "5.00",
      total: "105.00",
    };

    expect(presentTiendaOnlineDelivery(quotedCharged)).toBe("CHARGED");
  });

  it("the SAME '0.00' distinguishes PENDING_QUOTE from FREE only through `kind` (E-008)", () => {
    const pending: ITiendaOnlineOrderAmounts = {
      kind: "PENDING_QUOTE",
      subtotal: "100.00",
      discountTotal: "0.00",
      partialTotal: "100.00",
    };
    const free: ITiendaOnlineOrderAmounts = {
      kind: "QUOTED",
      subtotal: "100.00",
      discountTotal: "0.00",
      deliveryFee: "0.00",
      total: "100.00",
    };

    expect(presentTiendaOnlineDelivery(pending)).not.toBe(
      presentTiendaOnlineDelivery(free),
    );
  });
});

describe("normalizeUnknownCode", () => {
  it("should turn underscores to spaces, lower-case, and upper-case the first letter", () => {
    expect(normalizeUnknownCode("READY_FOR_PICKUP")).toBe("Ready for pickup");
  });

  it("should NOT truncate a value at or under the cap", () => {
    const atCap = "A".repeat(TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH);
    const result = normalizeUnknownCode(atCap);

    expect(result).not.toContain("…");
    expect(result.length).toBeLessThanOrEqual(
      TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH,
    );
  });

  it("should truncate a value over the cap with an ellipsis (U+2026), never a raw cut", () => {
    const tooLong = "SOME_VERY_LONG_STATUS_VALUE_NOBODY_ASKED_FOR";
    const result = normalizeUnknownCode(tooLong);

    expect(result.length).toBeLessThanOrEqual(
      TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH,
    );
    expect(result.endsWith("…")).toBe(true);
  });

  it("the cap counts the ellipsis itself — the output never exceeds the max length, exactly", () => {
    const tooLong = "SOME_VERY_LONG_STATUS_VALUE_NOBODY_ASKED_FOR";

    expect(normalizeUnknownCode(tooLong).length).toBe(
      TIENDA_ONLINE_UNKNOWN_CODE_MAX_LENGTH,
    );
  });

  it("should never throw, even for an empty string", () => {
    expect(() => normalizeUnknownCode("")).not.toThrow();
  });
});

describe("orderStatusPresentation", () => {
  it("known status: `known` is true and `hue` is never `accent` (accent is reserved for action/selection)", () => {
    // At least one value QAB_ORDER_STATUSES actually contains, so this exercises a
    // REAL known branch and not a guess.
    const result = orderStatusPresentation("CANCELLED");

    expect(result.known).toBe(true);
    expect(result.hue).not.toBe("accent");
  });

  it("no exhaustive switch without a default: every published status resolves without throwing", () => {
    for (const status of QAB_ORDER_STATUSES) {
      expect(() => orderStatusPresentation(status)).not.toThrow();
    }
  });

  it("unknown status: label is normalizeUnknownCode(status), hue neutral, known false", () => {
    const result = orderStatusPresentation("SOME_STATUS_QAB_ADDS_IN_2027");

    expect(result.known).toBe(false);
    expect(result.hue).toBe("neutral");
    expect(result.label).toBe(normalizeUnknownCode("SOME_STATUS_QAB_ADDS_IN_2027"));
  });

  it("does not throw on an empty string", () => {
    expect(() => orderStatusPresentation("")).not.toThrow();
  });
});

describe("cancelledByLabel", () => {
  it("falls back to normalizeUnknownCode for a value it does not translate", () => {
    const value = "SOME_REASON_NOBODY_DECLARED";

    expect(cancelledByLabel(value)).toBe(normalizeUnknownCode(value));
  });

  it("resolves every known value from QAB_ORDER_CANCELLED_BY without throwing", () => {
    for (const value of QAB_ORDER_CANCELLED_BY) {
      expect(() => cancelledByLabel(value)).not.toThrow();
      expect(typeof cancelledByLabel(value)).toBe("string");
    }
  });

  it("uses the SAME normalization rule as orderStatusPresentation's unknown branch (E-014: one definition)", () => {
    const unknownValue = "TOTALLY_UNRECOGNISED_REASON";

    expect(cancelledByLabel(unknownValue)).toBe(
      orderStatusPresentation(unknownValue).label,
    );
  });
});

describe("formatOrderAmount", () => {
  it("matches the contract's own worked example: (1250.00, CUP) -> 1.250,00 CUP", () => {
    expect(formatOrderAmount("1250.00", "CUP")).toBe("1.250,00 CUP");
  });

  it("keeps the sign in front, so -0.50 does not come out as 0,50", () => {
    expect(formatOrderAmount("-0.50", "CUP")).toBe("-0,50 CUP");
  });

  it("preserves the two decimals of the input VERBATIM, unrounded", () => {
    expect(formatOrderAmount("1234.07", "CUP")).toBe("1.234,07 CUP");
  });

  it("groups only the integer part, for a value with more than three integer digits", () => {
    expect(formatOrderAmount("1000000.00", "CUP")).toBe("1.000.000,00 CUP");
  });

  it("always appends the currency code, even one different from any order-level code", () => {
    expect(formatOrderAmount("10.00", "USD")).toBe("10,00 USD");
  });
});

describe("formatOrderQuantity", () => {
  it("drops trailing zeros, and the separator with them", () => {
    expect(formatOrderQuantity("2.000")).toBe("2");
  });

  it("drops only the trailing zero, keeping the separator when a fraction remains", () => {
    expect(formatOrderQuantity("1.500")).toBe("1,5");
  });

  it("keeps every significant decimal", () => {
    expect(formatOrderQuantity("0.125")).toBe("0,125");
  });

  it("keeps the sign", () => {
    expect(formatOrderQuantity("-1.000")).toBe("-1");
  });
});

describe("the five counted texts — count as a plain integer, never grouped", () => {
  const counters = {
    unattendedCountLabel,
    unassignedTitle,
    conversionMismatchTitle,
    lineCountLabel,
    productsSectionLabel,
  };

  for (const [name, fn] of Object.entries(counters)) {
    describe(name, () => {
      it("renders the count as a PLAIN integer, with no thousands grouping", () => {
        const result = fn(1500);

        expect(result).toContain("1500");
        expect(result).not.toContain("1.500");
        expect(result).not.toContain("1,500");
      });

      it("never throws for zero", () => {
        expect(() => fn(0)).not.toThrow();
      });
    });
  }
});

/**
 * "The rule of two forms" (§9.4 of the contract, and F-020's own failure) is about
 * NOT applying a single plural template to `n = 1` — `{n} líneas` with `n = 1` must
 * not print "1 líneas". It does NOT mandate that the wording differ from the plural
 * whenever the phrase has no noun to inflect at all.
 *
 * Four of the five counters DO carry an inflecting noun, and for those the singular
 * and plural forms are genuinely different words (`pedido`/`pedidos`,
 * `línea`/`líneas`, `no se puede`/`no se pueden`, `PRODUCTO`/`PRODUCTOS`).
 * `unattendedCountLabel` does not: the design contract fixes it as "1 sin atender" /
 * "{N} sin atender" (`.agents/designs/F-011.md` § 17 — "Las dos ramas comparten la
 * subcadena `sin atender`"; criteria 34/35 pin the exact `textContent` in the
 * browser). Spanish "sin atender" does not inflect for number, so there is no
 * separate word to fail to use — generalising "must differ" to this one function
 * asserts a copy change the design explicitly forbids (E-016 in reverse: rejecting
 * correct code because a test over-generalised a rule from four cases to five).
 */
describe("the singular (1) form vs. the rest — only where a noun actually inflects", () => {
  const inflecting = {
    unassignedTitle,
    conversionMismatchTitle,
    lineCountLabel,
    productsSectionLabel,
  };

  for (const [name, fn] of Object.entries(inflecting)) {
    it(`${name}: the singular form is textually different from the plural form, not just the digit`, () => {
      const singular = fn(1).replace(/\d+/g, "");
      const plural = fn(2).replace(/\d+/g, "");

      expect(singular).not.toBe(plural);
    });
  }

  it("unattendedCountLabel: singular and plural share the SAME words on purpose (design § 17) — only the digit changes", () => {
    const singular = unattendedCountLabel(1).replace(/\d+/g, "");
    const plural = unattendedCountLabel(2).replace(/\d+/g, "");
    const anotherPlural = unattendedCountLabel(5).replace(/\d+/g, "");

    expect(singular).toBe(plural);
    expect(singular).toBe(anotherPlural);
  });
});

describe("formatOrderDateShort / formatOrderDateLong / formatOrderTime", () => {
  const VALID_ISO = "2026-08-20T10:05:00.000Z";
  const UNPARSEABLE = "not-a-real-date";

  const functions = { formatOrderDateShort, formatOrderDateLong, formatOrderTime };

  for (const [name, fn] of Object.entries(functions)) {
    describe(name, () => {
      it("gives the SAME fallback for null and for an unparseable string", () => {
        expect(fn(null)).toBe(fn(UNPARSEABLE));
      });

      it("never prints an unparseable value raw", () => {
        expect(fn(UNPARSEABLE)).not.toBe(UNPARSEABLE);
      });

      it("transforms a valid instant, rather than echoing it verbatim", () => {
        expect(fn(VALID_ISO)).not.toBe(VALID_ISO);
        expect(fn(VALID_ISO)).not.toBe(fn(null));
      });
    });
  }

  it("the three shapes are genuinely different formats of the same instant", () => {
    expect(formatOrderDateShort(VALID_ISO)).not.toBe(
      formatOrderDateLong(VALID_ISO),
    );
    expect(formatOrderTime(VALID_ISO)).not.toBe(
      formatOrderDateShort(VALID_ISO),
    );
  });
});

describe("rateSnapshotProvenance", () => {
  it("names the base currency", () => {
    const result = rateSnapshotProvenance({
      base: "CUP",
      capturedAt: "2026-08-26T02:00:00.000Z",
    });

    expect(result).toContain("CUP");
  });

  it("has two distinct forms: a parseable capturedAt and a null/unparseable one", () => {
    const withDate = rateSnapshotProvenance({
      base: "CUP",
      capturedAt: "2026-08-26T02:00:00.000Z",
    });
    const withoutDate = rateSnapshotProvenance({ base: "CUP", capturedAt: null });

    expect(withDate).not.toBe(withoutDate);
  });

  it("never prints an unparseable capturedAt raw", () => {
    const result = rateSnapshotProvenance({
      base: "CUP",
      capturedAt: "not-a-real-date",
    });

    expect(result).not.toContain("not-a-real-date");
  });
});

/**
 * F-012 — four new pure functions added to the same `.ts` (`.agents/designs/F-012.md`
 * § 8.2). Per interfaces contract § 8.4, THIS SUITE PINS THE FORM, NOT THE WORDS: the
 * exact Spanish prose is the design contract's to fix and the `qa` agent's to verify in
 * the browser (E-016, E-018). Hard-coding a whole sentence here would break on the
 * first wording tweak and would not really be testing the function's logic (E-008: a
 * test that a pure copy change breaks, for reasons unrelated to whether the code is
 * "wrong", is not a strong signal).
 *
 * Note for the report: these four are NOT named in the arch-guardian's § 8.4
 * "cubierto" list (that list only names schemas/lib functions the interfaces contract
 * itself owns). They are the ui-designer's addition to the same file, made after the
 * interfaces contract was frozen. Covered here per the dev-tester's own brief, with the
 * caution the ambiguity calls for — see the report.
 */

describe("orderStatusFailureCopy — the ten qabError codes grouped into three phrases (design § 6.2)", () => {
  it("is total: never throws, for a code it recognises or one it does not", () => {
    expect(() => orderStatusFailureCopy("ORDER_DELIVERY_NOT_QUOTED")).not.toThrow();
    expect(() =>
      orderStatusFailureCopy("A_CODE_THAT_DOES_NOT_EXIST_YET"),
    ).not.toThrow();
  });

  it("groups NOT_CONFIGURED and SYNC_NOT_CONFIGURED under the SAME phrase (design § 6.2, row 4 — the merchant-fixable pair)", () => {
    expect(orderStatusFailureCopy("NOT_CONFIGURED")).toBe(
      orderStatusFailureCopy("SYNC_NOT_CONFIGURED"),
    );
  });

  it("gives ORDER_DELIVERY_NOT_QUOTED a phrase of its own, different from the NOT_CONFIGURED group", () => {
    expect(orderStatusFailureCopy("ORDER_DELIVERY_NOT_QUOTED")).not.toBe(
      orderStatusFailureCopy("NOT_CONFIGURED"),
    );
  });

  it("falls an unrecognised code back to the SAME generic phrase as a known-but-unremarkable one (e.g. UNKNOWN_ORDER) — total over any string", () => {
    expect(orderStatusFailureCopy("A_CODE_THAT_DOES_NOT_EXIST_YET")).toBe(
      orderStatusFailureCopy("UNKNOWN_ORDER"),
    );
  });

  it("the generic-fallback phrase differs from both special-cased groups", () => {
    const generic = orderStatusFailureCopy("UNKNOWN_ORDER");

    expect(generic).not.toBe(orderStatusFailureCopy("ORDER_DELIVERY_NOT_QUOTED"));
    expect(generic).not.toBe(orderStatusFailureCopy("NOT_CONFIGURED"));
  });

  it.each([
    "ORDER_DELIVERY_NOT_QUOTED",
    "NOT_CONFIGURED",
    "SYNC_NOT_CONFIGURED",
    "UNKNOWN_ORDER",
    "TRANSPORT",
  ])(
    "never prints the raw code, QAB_STATUS_UPSTREAM, or an HTTP status for %s (ADR 0034, E-009)",
    (code) => {
      const copy = orderStatusFailureCopy(code);

      expect(copy).not.toContain(code);
      expect(copy).not.toContain("QAB_STATUS_UPSTREAM");
      expect(copy).not.toMatch(/\b(400|401|403|404|409|502|503)\b/);
    },
  );
});

describe("orderStatusConfirmTitle — interpolates the target's OWN label, not a re-typed word (E-014)", () => {
  it.each(["CONFIRMED", "READY", "DELIVERED", "CANCELLED", "REJECTED_BY_STORE"])(
    "contains orderStatusPresentation(%s).label",
    (target) => {
      const { label } = orderStatusPresentation(target);

      expect(orderStatusConfirmTitle(target)).toContain(label);
    },
  );

  it("two different targets produce two different titles", () => {
    expect(orderStatusConfirmTitle("DELIVERED")).not.toBe(
      orderStatusConfirmTitle("CANCELLED"),
    );
  });
});

describe("orderStatusAppliedNotice / orderStatusDivergedNotice — pure interpolation, and NEVER sharing a prefix (design § 11, point 2)", () => {
  it("orderStatusAppliedNotice contains the label it is given, verbatim", () => {
    const marker = "MARKER_LABEL_APPLIED_9f3";

    expect(orderStatusAppliedNotice(marker)).toContain(marker);
  });

  it("orderStatusDivergedNotice contains BOTH labels it is given, verbatim, reportado before actual", () => {
    const reportado = "MARKER_REPORTED_a1";
    const actual = "MARKER_ACTUAL_b2";

    const notice = orderStatusDivergedNotice(reportado, actual);

    expect(notice).toContain(reportado);
    expect(notice).toContain(actual);
    expect(notice.indexOf(reportado)).toBeLessThan(notice.indexOf(actual));
  });

  it("swapping the two labels changes the output — the two positions are not interchangeable", () => {
    const a = "MARKER_ONE_x1";
    const b = "MARKER_TWO_y2";

    expect(orderStatusDivergedNotice(a, b)).not.toBe(orderStatusDivergedNotice(b, a));
  });

  it("the success notice and the divergence notice do NOT start with the same word — the exact collision the design caught and rewrote (§ 11, point 2)", () => {
    const label = "MARKER_SHARED_LABEL_z9";

    const applied = orderStatusAppliedNotice(label);
    const diverged = orderStatusDivergedNotice(label, label);

    expect(diverged.split(" ")[0]).not.toBe(applied.split(" ")[0]);
  });
});
