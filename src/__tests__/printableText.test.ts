import { describe, it, expect } from "vitest";

/**
 * F-034, contract § 3.5, ADR 0120 — `src/utils/printableText.ts`, NEW.
 *
 * The one place the control-character bound is declared. Three schemas (§ 3.2, § 3.4)
 * and the ticket line builder (§ 7.3) all read this module; it must be a LEAF with no
 * imports of its own (E-028) — that is verified indirectly here by never importing it
 * alongside a schema module in a way that would surface a cycle, and directly by the
 * `arch-guardian`'s own review, not by this test.
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019) — this whole file would otherwise fail at collection and take
 * every other `__tests__` file down with it.
 */
const {
  CONTROL_CHARACTERS_PATTERN,
  CONTROL_CHARACTERS_MESSAGE,
  hasControlCharacters,
  stripControlCharacters,
} = await import("@/utils/printableText");

// The concrete attack string from the dossier's own finding: ESC (0x1B), "p", NUL
// (0x00), 0x19, 0xFA — the "cash drawer kick" sequence a barcode scanner fires when
// aimed at the wrong input. This is what E-008 calls the datum that discriminates:
// a clean name passes with or without the `.refine` in place.
const KICK_SEQUENCE = "Ana\x1Bp\x00\x19\xFA";

describe("CONTROL_CHARACTERS_PATTERN", () => {
  it("matches the four edges of the C0/DEL/C1 range: \\x00, \\x1F, \\x7F, \\x9F", () => {
    expect(CONTROL_CHARACTERS_PATTERN.test("\x00")).toBe(true);
    expect(CONTROL_CHARACTERS_PATTERN.test("\x1F")).toBe(true);
    expect(CONTROL_CHARACTERS_PATTERN.test("\x7F")).toBe(true);
    expect(CONTROL_CHARACTERS_PATTERN.test("\x9F")).toBe(true);
  });

  it("does NOT match the space (0x20), 0x21, or an accented letter above 0x9F", () => {
    // A name with tildes is routine in this market; a bound that eats accents would
    // break the catalogue for a Cuban business.
    expect(CONTROL_CHARACTERS_PATTERN.test(" ")).toBe(false);
    expect(CONTROL_CHARACTERS_PATTERN.test("\x21")).toBe(false);
    expect(CONTROL_CHARACTERS_PATTERN.test("é")).toBe(false);
    expect(CONTROL_CHARACTERS_PATTERN.test("Roberto Pérez")).toBe(false);
  });

  it("has no /g flag — a shared instance used for both .test and .replace must not carry lastIndex between calls", () => {
    expect(CONTROL_CHARACTERS_PATTERN.global).toBe(false);
  });
});

describe("hasControlCharacters", () => {
  it("returns true on the concrete kick sequence (the datum that discriminates, E-008)", () => {
    expect(hasControlCharacters(KICK_SEQUENCE)).toBe(true);
  });

  it("returns false on a clean, accented name", () => {
    expect(hasControlCharacters("Roberto Pérez")).toBe(false);
  });

  it("returns false for non-string input", () => {
    expect(hasControlCharacters(undefined)).toBe(false);
    expect(hasControlCharacters(null)).toBe(false);
    expect(hasControlCharacters(42)).toBe(false);
    expect(hasControlCharacters({})).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(hasControlCharacters("")).toBe(false);
  });
});

describe("stripControlCharacters", () => {
  it('removes only the bytes IN RANGE from the kick sequence, WITHOUT inserting a space ("Anapú", not "Ana p ú")', () => {
    // A control byte is not a word separator: turning it into a space would move the
    // columns padLine already computed for the ticket. The sequence's last byte, 0xFA,
    // is the printer command's second timing parameter (250) and happens to render as
    // "ú" — it sits ABOVE the C1 range (0x7F-0x9F) this module declares, so it is left
    // untouched. Only \x1B, \x00 and \x19 (all within \x00-\x1F) are removed.
    expect(stripControlCharacters(KICK_SEQUENCE)).toBe("Anapú");
  });

  it("leaves a clean, accented name untouched", () => {
    expect(stripControlCharacters("Roberto Pérez")).toBe("Roberto Pérez");
  });

  it("returns an empty string for non-string input", () => {
    expect(stripControlCharacters(undefined)).toBe("");
    expect(stripControlCharacters(null)).toBe("");
    expect(stripControlCharacters(123)).toBe("");
  });

  it("is idempotent: stripping an already-clean string is a no-op", () => {
    const clean = stripControlCharacters(KICK_SEQUENCE);
    expect(stripControlCharacters(clean)).toBe(clean);
  });
});

describe("CONTROL_CHARACTERS_MESSAGE", () => {
  it("is a fixed, non-empty string that quotes nothing from any rejected value (E-031)", () => {
    expect(typeof CONTROL_CHARACTERS_MESSAGE).toBe("string");
    expect(CONTROL_CHARACTERS_MESSAGE.length).toBeGreaterThan(0);
    // It cannot echo the attack sequence back: that would put the very sequence being
    // refused into the response body and into any log that records it.
    expect(CONTROL_CHARACTERS_MESSAGE).not.toContain("\x1B");
    expect(CONTROL_CHARACTERS_MESSAGE).not.toContain(KICK_SEQUENCE);
  });
});
