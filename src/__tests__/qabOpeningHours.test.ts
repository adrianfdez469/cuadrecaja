import { describe, it, expect } from "vitest";
import {
  collectOpeningHoursIssues,
  isOpeningHours,
  openingHoursMinutes,
  openingHoursSchema,
} from "@/schemas/qabOpeningHours";
import {
  QAB_OPENING_HOURS_DAYS,
  QAB_OPENING_HOURS_ISSUE_CODES,
  QAB_OPENING_HOURS_MAX_BYTES,
} from "@/constants/qab";

/**
 * F-005 — `src/schemas/qabOpeningHours.ts` (ADR 0031), the validator of the v9 opening-hours
 * format. This is the piece the contract calls out as central: 17 closed issue codes, a FIXED
 * check order, and a "skip a check whose prerequisite already failed" rule.
 *
 * Written against `.agents/specs/F-005.md` §2 ONLY — the implementation does not exist yet at
 * the time this file is written. Every fixture below isolates ONE violation at a time (E-008):
 * a full, otherwise-valid week with a single day or a single window carrying the one thing
 * under test, so a passing assertion actually discriminates broken code from correct code.
 */

type IDay = (typeof QAB_OPENING_HOURS_DAYS)[number];
type IWindow = { from: string; to: string };

function emptyWeek(): Record<IDay, IWindow[]> {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function calendar(overrides: Partial<Record<IDay, IWindow[]>> = {}) {
  return { version: 1, days: { ...emptyWeek(), ...overrides } };
}

function codesOf(input: unknown): string[] {
  return collectOpeningHoursIssues(input).map((issue) => issue.code);
}

describe("QAB_OPENING_HOURS_ISSUE_CODES", () => {
  it("should hold exactly the 17 codes of the closed vocabulary", () => {
    expect(QAB_OPENING_HOURS_ISSUE_CODES).toHaveLength(17);
    expect([...QAB_OPENING_HOURS_ISSUE_CODES]).toEqual([
      "SIZE_EXCEEDED",
      "NOT_AN_OBJECT",
      "UNKNOWN_KEY",
      "VERSION_INVALID",
      "DAYS_NOT_AN_OBJECT",
      "DAY_MISSING",
      "DAY_UNKNOWN",
      "DAY_NOT_AN_ARRAY",
      "TOO_MANY_WINDOWS",
      "WINDOW_NOT_AN_OBJECT",
      "TIME_FORMAT_INVALID",
      "END_OF_DAY_IN_FROM",
      "EMPTY_WINDOW",
      "WINDOWS_UNORDERED",
      "WINDOWS_OVERLAP",
      "OVERNIGHT_NOT_LAST",
      "MULTIPLE_OVERNIGHT",
    ]);
  });
});

describe("collectOpeningHoursIssues — valid calendars produce NO issues", () => {
  it("should accept an empty array as a closed day", () => {
    const cal = calendar({ mon: [] });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
    expect(isOpeningHours(cal)).toBe(true);
  });

  it('should accept {from: "00:00", to: "24:00"} as a full-day window', () => {
    const cal = calendar({ mon: [{ from: "00:00", to: "24:00" }] });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });

  it("should accept a single window that crosses midnight when it is the LAST (and only) window of the day", () => {
    const cal = calendar({ mon: [{ from: "22:00", to: "02:00" }] });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });

  it("should accept an overnight window as the last one even after a normal window earlier the same day", () => {
    const cal = calendar({
      mon: [
        { from: "09:00", to: "13:00" },
        { from: "22:00", to: "02:00" },
      ],
    });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });

  it("should accept two windows that touch (one ends exactly when the next starts): touching is not overlapping", () => {
    const cal = calendar({
      mon: [
        { from: "09:00", to: "13:00" },
        { from: "13:00", to: "18:00" },
      ],
    });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });

  it("should accept exactly 4 windows in one day (the maximum, not one past it)", () => {
    const cal = calendar({
      mon: [
        { from: "00:00", to: "01:00" },
        { from: "01:00", to: "02:00" },
        { from: "02:00", to: "03:00" },
        { from: "03:00", to: "04:00" },
      ],
    });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });

  it("should accept a full week mixing closed days, a full-day window and normal windows", () => {
    const cal = calendar({
      mon: [],
      tue: [{ from: "09:00", to: "18:00" }],
      wed: [{ from: "09:00", to: "13:00" }, { from: "14:00", to: "18:00" }],
      thu: [{ from: "00:00", to: "24:00" }],
      fri: [{ from: "09:00", to: "22:00" }],
      sat: [{ from: "10:00", to: "14:00" }],
      sun: [],
    });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
    expect(isOpeningHours(cal)).toBe(true);
  });

  it("should validate through openingHoursSchema too (safeParse.success)", () => {
    const cal = calendar({ mon: [{ from: "09:00", to: "17:00" }] });
    expect(openingHoursSchema.safeParse(cal).success).toBe(true);
  });
});

describe("collectOpeningHoursIssues — the 14 violations of acceptance criterion 8, one at a time", () => {
  it("VERSION_INVALID: version is not 1", () => {
    const cal = { version: 2, days: emptyWeek() };
    expect(codesOf(cal)).toContain("VERSION_INVALID");
  });

  it("DAY_MISSING: days is missing one key (sun)", () => {
    const days = emptyWeek();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (days as any).sun;
    const cal = { version: 1, days };
    const issues = collectOpeningHoursIssues(cal);
    expect(issues).toEqual([{ code: "DAY_MISSING", path: ["days", "sun"] }]);
  });

  it("DAY_UNKNOWN: days has one extra key", () => {
    const cal = { version: 1, days: { ...emptyWeek(), hol: [] } };
    const issues = collectOpeningHoursIssues(cal);
    expect(issues).toEqual([{ code: "DAY_UNKNOWN", path: ["days", "hol"] }]);
  });

  it('DAY_UNKNOWN + DAY_MISSING: an unknown day key ("lun") both introduces an unknown day and leaves "mon" absent', () => {
    const days = emptyWeek();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (days as any).mon;
    const cal = { version: 1, days: { ...days, lun: [] } };

    const issues = collectOpeningHoursIssues(cal);

    expect(issues).toContainEqual({ code: "DAY_MISSING", path: ["days", "mon"] });
    expect(issues).toContainEqual({ code: "DAY_UNKNOWN", path: ["days", "lun"] });
    expect(issues).toHaveLength(2);
  });

  it("TOO_MANY_WINDOWS: 5 windows in one day (max is 4)", () => {
    const cal = calendar({
      mon: [
        { from: "00:00", to: "01:00" },
        { from: "01:00", to: "02:00" },
        { from: "02:00", to: "03:00" },
        { from: "03:00", to: "04:00" },
        { from: "04:00", to: "05:00" },
      ],
    });
    const issues = collectOpeningHoursIssues(cal);
    expect(issues).toEqual([{ code: "TOO_MANY_WINDOWS", path: ["days", "mon"] }]);
  });

  it("EMPTY_WINDOW: from equals to", () => {
    const cal = calendar({ mon: [{ from: "09:00", to: "09:00" }] });
    const issues = collectOpeningHoursIssues(cal);
    expect(issues.map((i) => i.code)).toEqual(["EMPTY_WINDOW"]);
    expect(issues[0].path.slice(0, 3)).toEqual(["days", "mon", 0]);
  });

  it("WINDOWS_UNORDERED: windows of the same day are not ascending by from", () => {
    const cal = calendar({
      mon: [
        { from: "13:00", to: "18:00" },
        { from: "09:00", to: "12:00" },
      ],
    });
    expect(codesOf(cal)).toContain("WINDOWS_UNORDERED");
  });

  it("WINDOWS_OVERLAP: a window starts before the previous one ends", () => {
    const cal = calendar({
      mon: [
        { from: "09:00", to: "13:00" },
        { from: "12:00", to: "18:00" },
      ],
    });
    const codes = codesOf(cal);
    expect(codes).toContain("WINDOWS_OVERLAP");
    expect(codes).not.toContain("WINDOWS_UNORDERED");
  });

  it("MULTIPLE_OVERNIGHT: two windows of the same day cross midnight", () => {
    const cal = calendar({
      mon: [
        { from: "22:00", to: "02:00" },
        { from: "23:00", to: "03:00" },
      ],
    });
    expect(codesOf(cal)).toContain("MULTIPLE_OVERNIGHT");
  });

  it("OVERNIGHT_NOT_LAST: a window that crosses midnight is not the last one of the day", () => {
    const cal = calendar({
      mon: [
        { from: "22:00", to: "02:00" },
        { from: "23:00", to: "23:30" },
      ],
    });
    const codes = codesOf(cal);
    expect(codes).toContain("OVERNIGHT_NOT_LAST");
    // The valid-companion case (the SAME overnight window, but last) must NOT trip this code —
    // otherwise this test would pass even if OVERNIGHT_NOT_LAST fired unconditionally (E-008).
    const validCal = calendar({
      mon: [
        { from: "09:00", to: "13:00" },
        { from: "22:00", to: "02:00" },
      ],
    });
    expect(codesOf(validCal)).not.toContain("OVERNIGHT_NOT_LAST");
  });

  it('TIME_FORMAT_INVALID: "9:00" (missing leading zero) is not HH:MM', () => {
    const cal = calendar({ mon: [{ from: "9:00", to: "17:00" }] });
    expect(codesOf(cal)).toContain("TIME_FORMAT_INVALID");
  });

  it('TIME_FORMAT_INVALID: "18:00:00" (seconds) is not HH:MM', () => {
    const cal = calendar({ mon: [{ from: "09:00", to: "18:00:00" }] });
    expect(codesOf(cal)).toContain("TIME_FORMAT_INVALID");
  });

  it('END_OF_DAY_IN_FROM: "24:00" is only valid in `to`, never in `from`', () => {
    const cal = calendar({ mon: [{ from: "24:00", to: "23:00" }] });
    const codes = codesOf(cal);
    expect(codes).toContain("END_OF_DAY_IN_FROM");
    // E-008 guard: the discriminating assertion. If the implementation folded this case into
    // the generic format check instead of its own code, this would incorrectly say
    // TIME_FORMAT_INVALID and the criterion-8 distinction between the two violations would be
    // untestable from the outside.
    expect(codes).not.toContain("TIME_FORMAT_INVALID");
  });

  it('UNKNOWN_KEY at the root: a "timezone" key the format does not declare', () => {
    const cal = { ...calendar(), timezone: "America/Havana" };
    expect(codesOf(cal)).toContain("UNKNOWN_KEY");
  });

  it("SIZE_EXCEEDED: serialised JSON over QAB_OPENING_HOURS_MAX_BYTES bytes", () => {
    // 1951 ASCII characters of padding lands the whole serialised object at exactly
    // 2049 UTF-8 bytes -- one past the 2048-byte cap -- computed and pinned down with
    // Buffer.byteLength before writing this test.
    const cal = { ...calendar(), padding: "x".repeat(1951) };
    expect(Buffer.byteLength(JSON.stringify(cal), "utf8")).toBe(QAB_OPENING_HOURS_MAX_BYTES + 1);

    expect(codesOf(cal)).toContain("SIZE_EXCEEDED");
  });
});

describe("collectOpeningHoursIssues — cutting rules (a check that cuts skips everything after it)", () => {
  it("SIZE_EXCEEDED cuts: an oversized payload that ALSO has an invalid version reports ONLY SIZE_EXCEEDED", () => {
    const cal = { version: 999, days: emptyWeek(), padding: "x".repeat(1951) };
    expect(collectOpeningHoursIssues(cal)).toEqual([{ code: "SIZE_EXCEEDED", path: [] }]);
  });

  it("should NOT report SIZE_EXCEEDED at exactly QAB_OPENING_HOURS_MAX_BYTES bytes (the cap itself is not 'over')", () => {
    const cal = { version: 1, days: emptyWeek(), padding: "x".repeat(1950) };
    expect(Buffer.byteLength(JSON.stringify(cal), "utf8")).toBe(QAB_OPENING_HOURS_MAX_BYTES);

    expect(codesOf(cal)).not.toContain("SIZE_EXCEEDED");
  });

  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "closed"],
    ["a number", 42],
  ])("NOT_AN_OBJECT cuts: %s reports ONLY NOT_AN_OBJECT", (_label, value) => {
    expect(collectOpeningHoursIssues(value)).toEqual([{ code: "NOT_AN_OBJECT", path: [] }]);
  });

  it("DAYS_NOT_AN_OBJECT cuts the day traversal: no DAY_MISSING/DAY_UNKNOWN follow it", () => {
    const cal = { version: 1, days: null };
    expect(collectOpeningHoursIssues(cal)).toEqual([{ code: "DAYS_NOT_AN_OBJECT", path: ["days"] }]);
  });

  it("DAY_NOT_AN_ARRAY on one day does not stop the other days from being checked, nor does it also report TOO_MANY_WINDOWS for that same day", () => {
    const cal = calendar({ mon: "closed" as unknown as IWindow[] });
    const issues = collectOpeningHoursIssues(cal);
    expect(issues).toEqual([{ code: "DAY_NOT_AN_ARRAY", path: ["days", "mon"] }]);
  });

  it("a day whose window has a malformed time skips that day's WINDOWS_OVERLAP/UNORDERED/OVERNIGHT checks entirely", () => {
    // Without the malformed `from`, these two windows would overlap AND be unordered.
    // If the implementation still ran the ordering/overlap pass over unparsed times, this
    // test would see WINDOWS_OVERLAP or WINDOWS_UNORDERED alongside TIME_FORMAT_INVALID.
    const cal = calendar({
      mon: [
        { from: "25:00", to: "10:00" },
        { from: "09:00", to: "11:00" },
      ],
    });
    const codes = codesOf(cal);
    expect(codes).toContain("TIME_FORMAT_INVALID");
    expect(codes).not.toContain("WINDOWS_OVERLAP");
    expect(codes).not.toContain("WINDOWS_UNORDERED");
    expect(codes).not.toContain("OVERNIGHT_NOT_LAST");
    expect(codes).not.toContain("MULTIPLE_OVERNIGHT");
  });
});

describe("collectOpeningHoursIssues — declared order (UNKNOWN_KEY, then VERSION_INVALID, then DAYS_NOT_AN_OBJECT)", () => {
  it("should report root UNKNOWN_KEY before VERSION_INVALID before DAYS_NOT_AN_OBJECT, in that order", () => {
    const cal = { timezone: "UTC", version: 2, days: null };
    const issues = collectOpeningHoursIssues(cal);
    expect(issues.map((i) => i.code)).toEqual(["UNKNOWN_KEY", "VERSION_INVALID", "DAYS_NOT_AN_OBJECT"]);
  });
});

describe("collectOpeningHoursIssues — other malformed shapes", () => {
  it("WINDOW_NOT_AN_OBJECT: an entry of a day's array that is not an object", () => {
    const cal = calendar({ mon: ["09:00-12:00" as unknown as IWindow] });
    expect(codesOf(cal)).toContain("WINDOW_NOT_AN_OBJECT");
  });

  it("UNKNOWN_KEY inside a window: an extra key besides from/to", () => {
    const cal = calendar({
      mon: [{ from: "09:00", to: "12:00", note: "call ahead" } as unknown as IWindow],
    });
    const issues = collectOpeningHoursIssues(cal);
    const unknownKeyIssue = issues.find((i) => i.code === "UNKNOWN_KEY");
    expect(unknownKeyIssue).toBeDefined();
    expect(unknownKeyIssue?.path[0]).toBe("days");
    expect(unknownKeyIssue?.path[1]).toBe("mon");
  });

  it('should accept "24:00" in `to` without treating the window as overnight', () => {
    const cal = calendar({ mon: [{ from: "22:00", to: "24:00" }] });
    expect(collectOpeningHoursIssues(cal)).toEqual([]);
  });
});

describe("isOpeningHours", () => {
  it("should return true for a valid calendar", () => {
    expect(isOpeningHours(calendar({ mon: [{ from: "09:00", to: "17:00" }] }))).toBe(true);
  });

  it("should return false for an invalid calendar", () => {
    expect(isOpeningHours({ version: 2, days: emptyWeek() })).toBe(false);
  });

  it("should return false for a completely foreign shape", () => {
    expect(isOpeningHours("not a calendar")).toBe(false);
    expect(isOpeningHours(null)).toBe(false);
    expect(isOpeningHours(undefined)).toBe(false);
  });
});

describe("openingHoursMinutes", () => {
  it.each([
    ["00:00", 0],
    ["09:00", 540],
    ["23:59", 1439],
    ["24:00", 1440],
  ])("should convert %s to %d minutes", (time, minutes) => {
    expect(openingHoursMinutes(time)).toBe(minutes);
  });

  it.each([["9:00"], ["18:00:00"], ["25:00"], ["24:01"], [""], ["noon"]])(
    "should throw on %s",
    (time) => {
      expect(() => openingHoursMinutes(time)).toThrow();
    }
  );
});

describe("openingHoursSchema", () => {
  it("should reject an invalid calendar and report the coded issues via ctx.addIssue", () => {
    const result = openingHoursSchema.safeParse({ version: 2, days: emptyWeek() });

    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("VERSION_INVALID");
    }
  });

  it("should parse a valid calendar into the typed IOpeningHours shape", () => {
    const input = calendar({ mon: [{ from: "09:00", to: "17:00" }] });
    const result = openingHoursSchema.parse(input);
    expect(result.version).toBe(1);
    expect(result.days.mon).toEqual([{ from: "09:00", to: "17:00" }]);
    expect(result.days.sun).toEqual([]);
  });

  it("should reject a calendar over the byte cap even though its .length is comfortably under 2048 (multibyte guard)", () => {
    // "á" is ONE UTF-16 code unit (string.length counts it as 1) but TWO UTF-8 bytes. 1000 of
    // them push the serialised size to ~2098 bytes while the JSON string itself is only ~1098
    // characters long. An implementation measuring `.length` instead of UTF-8 byte size would
    // let this through -- this is the test that forces the byte-accurate measurement E-005-style.
    const cal = { ...calendar(), padding: "á".repeat(1000) };
    const serialised = JSON.stringify(cal);

    expect(serialised.length).toBeLessThan(QAB_OPENING_HOURS_MAX_BYTES);
    expect(Buffer.byteLength(serialised, "utf8")).toBeGreaterThan(QAB_OPENING_HOURS_MAX_BYTES);

    const result = openingHoursSchema.safeParse(cal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toEqual(["SIZE_EXCEEDED"]);
    }
  });
});
