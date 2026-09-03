import { describe, it, expect } from "vitest";
import {
  toStrictPath,
  toLoosePath,
  matchesPathSegment,
  isApiPath,
  isAllowlistedApiPath,
  requiresApiAuth,
} from "@/middleware/apiAuthGate";
import { API_AUTH_ALLOWLIST } from "@/constants/apiAuth";

/**
 * F-018 — the authentication gate for `/api/`.
 *
 * Every case below comes straight from the interface contract table in
 * `.agents/specs/F-018.md` (ADR 0017, "allowlist por segmentos con normalización asimétrica").
 * These functions must not import anything from `next/*`: they are pure string logic, which is
 * exactly what makes them testable without Next, a database, or HTTP.
 *
 * The asymmetry is the point of the whole design: `toStrictPath` (no percent-decoding, case kept)
 * decides what is PERMITTED; `toLoosePath` (percent-decoded, lowercased) decides what counts as
 * an API path at all. Normalizing more can only GATE more, never PERMIT more.
 */

describe("toStrictPath", () => {
  it.each([
    ["/api/negocio", "/api/negocio"],
    ["/api/negocio/", "/api/negocio"],
    ["//api/negocio", "/api/negocio"],
    ["/api//negocio", "/api/negocio"],
    ["/api/../api/negocio", "/api/negocio"],
    ["/api/app/../negocio", "/api/negocio"],
    ["/api/./negocio", "/api/negocio"],
    ["/api/publico-falso", "/api/publico-falso"],
    ["/api/backup", "/api/backup"],
    ["/api", "/api"],
    ["/api/AUTH/session", "/api/AUTH/session"],
    ["/api/%2561pp/health", "/api/%2561pp/health"],
    ["/api/%zz/negocio", "/api/%zz/negocio"],
    ["/api/auth", "/api/auth"],
    ["/api/auth/", "/api/auth"],
    ["/pos", "/pos"],
    ["/api/../pos", "/pos"],
    ["/", "/"],
    ["", "/"],
    ["/api/%c0%afnegocio", "/api/%c0%afnegocio"],
    ["/api/negocio/../../pos", "/pos"],
  ])("should normalize %s structurally to %s (no decoding, no case changes)", (input, expected) => {
    expect(toStrictPath(input)).toBe(expected);
  });

  it("should never let '..' rise above the root", () => {
    expect(toStrictPath("/../../api/negocio")).toBe("/api/negocio");
    expect(toStrictPath("/../..")).toBe("/");
    expect(toStrictPath("/..")).toBe("/");
  });

  it("should normalize an input that is not a string starting with '/' to the root", () => {
    // The pure function must be total: NextRequest.pathname is always such a string, but the
    // contract explicitly calls this out as a rule the function must satisfy regardless.
    expect(toStrictPath("api/negocio")).toBe("/");
  });

  it("should NOT percent-decode", () => {
    expect(toStrictPath("/api/%2561pp/health")).not.toBe("/api/app/health");
  });

  it("should NOT change case", () => {
    expect(toStrictPath("/api/AUTH/session")).toBe("/api/AUTH/session");
  });
});

describe("toLoosePath", () => {
  it.each([
    ["/api/negocio", "/api/negocio"],
    ["/api/negocio/", "/api/negocio"],
    ["//api/negocio", "/api/negocio"],
    ["/api//negocio", "/api/negocio"],
    ["/api/../api/negocio", "/api/negocio"],
    ["/api/app/../negocio", "/api/negocio"],
    ["/api/./negocio", "/api/negocio"],
    ["/api/publico-falso", "/api/publico-falso"],
    ["/api/backup", "/api/backup"],
    ["/api", "/api"],
    ["/api/AUTH/session", "/api/auth/session"],
    ["/api/%2561pp/health", "/api/app/health"],
    ["/api/%zz/negocio", "/api/%zz/negocio"],
    ["/api/auth", "/api/auth"],
    ["/api/auth/", "/api/auth"],
    ["/api/app/health", "/api/app/health"],
    ["/api/app/auth/login", "/api/app/auth/login"],
    ["/pos", "/pos"],
    ["/api/../pos", "/pos"],
    ["/", "/"],
    ["", "/"],
    ["/api/%c0%afnegocio", "/api/%c0%afnegocio"],
    ["/api/app/%c0%afsubruta", "/api/app/%c0%afsubruta"],
    ["/api/negocio/../../pos", "/pos"],
  ])(
    "should best-effort percent-decode, lowercase, then structurally normalize %s to %s",
    (input, expected) => {
      expect(toLoosePath(input)).toBe(expected);
    },
  );

  it("should lowercase the result", () => {
    expect(toLoosePath("/api/AUTH/session")).toBe("/api/auth/session");
  });

  it("should decode double-encoded percent sequences up to 3 passes", () => {
    // %2561 decodes once to %61, which decodes again to "a": /api/%2561pp/health -> /api/app/health
    expect(toLoosePath("/api/%2561pp/health")).toBe("/api/app/health");
  });

  it("should never throw when decodeURIComponent would throw, and should keep the last valid pass", () => {
    // decodeURIComponent('%zz') and decodeURIComponent('%c0%af') both throw URIError in Node.
    expect(() => toLoosePath("/api/%zz/negocio")).not.toThrow();
    expect(() => toLoosePath("/api/%c0%afnegocio")).not.toThrow();
    expect(toLoosePath("/api/%zz/negocio")).toBe("/api/%zz/negocio");
    expect(toLoosePath("/api/%c0%afnegocio")).toBe("/api/%c0%afnegocio");
  });

  it("should normalize an input that is not a string starting with '/' to the root", () => {
    expect(toLoosePath("api/negocio")).toBe("/");
  });
});

describe("matchesPathSegment", () => {
  it("should match an exact path", () => {
    expect(matchesPathSegment("/api/auth", "/api/auth")).toBe(true);
  });

  it("should match a path under the entry as a segment boundary", () => {
    expect(matchesPathSegment("/api/auth/session", "/api/auth")).toBe(true);
    expect(matchesPathSegment("/api/backup/generate", "/api/backup/generate")).toBe(true);
  });

  it("should NOT match a path that merely starts with the entry as a raw string prefix", () => {
    // The bypass this function exists to close: /api/publico-falso must not match /api/public,
    // and /api/authors must not match /api/auth.
    expect(matchesPathSegment("/api/publico-falso", "/api/public")).toBe(false);
    expect(matchesPathSegment("/api/authors", "/api/auth")).toBe(false);
    expect(matchesPathSegment("/api/appearance", "/api/app")).toBe(false);
    expect(matchesPathSegment("/api/promotersXYZ", "/api/promoters")).toBe(false);
  });

  it("should not match an unrelated path", () => {
    expect(matchesPathSegment("/api/negocio", "/api/auth")).toBe(false);
  });
});

describe("isApiPath", () => {
  it.each([
    ["/api", true],
    ["/api/negocio", true],
    ["/api/anything", true],
    ["//api/negocio", true],
    ["/api/AUTH/session", true],
    ["/api/%2561pp/health", true],
    ["/pos", false],
    ["/api/../pos", false],
    ["/", false],
    ["", false],
  ])("should evaluate isApiPath(%s) to %s using the loose form", (input, expected) => {
    expect(isApiPath(input)).toBe(expected);
  });
});

describe("isAllowlistedApiPath", () => {
  it.each([
    ["/api/auth", true],
    ["/api/auth/", true],
    ["/api/auth/session", true],
    ["/api/app/health", true],
    ["/api/app/auth/login", true],
    ["/api/backup/generate", true],
    ["/api/promoters/self-enroll", true],
    ["/api/negocio", false],
    ["/api/publico-falso", false],
    ["/api/backup", false],
    ["/api/backup/otro", false],
    ["/api/appearance", false],
    ["/api/authors", false],
    // Uppercase and percent-encoded forms must NOT be allowlisted on the strict form: the
    // allowlist only recognizes the exact literal form, on purpose (ADR 0017).
    ["/api/AUTH/session", false],
    ["/api/%2561pp/health", false],
  ])("should evaluate isAllowlistedApiPath(%s) to %s using the strict form", (input, expected) => {
    expect(isAllowlistedApiPath(input)).toBe(expected);
  });
});

describe("API_AUTH_ALLOWLIST — the nine entries of acceptance criterion 5, and no more", () => {
  // Criterion 5 fixes the allowlist as a literal, closed enumeration; the human decided on
  // 2026-09-02 that `POST /api/chatbot` does NOT belong in it (F-018 finding 2), and nothing
  // exercises the array itself elsewhere: every other case above only checks whether a
  // PARTICULAR path is or isn't allowlisted, so a tenth entry could be added — or one of the
  // nine silently dropped — without turning any of them red. This is the test that catches that:
  // it pins the exact set, so adding or removing an entry means facing a red test and a
  // deliberate decision, never a silent drift of the allowlist's contents.
  const expectedAllowlist = [
    "/api/auth",
    "/api/app",
    "/api/crons",
    "/api/public",
    "/api/init-superadmin",
    "/api/activar-cuenta",
    "/api/contact-form",
    "/api/promoters",
    "/api/backup/generate",
  ];

  it("should contain exactly the nine entries fixed by criterion 5, in order", () => {
    expect(API_AUTH_ALLOWLIST).toStrictEqual(expectedAllowlist);
  });

  it("should have exactly nine entries — not eight, not ten", () => {
    expect(API_AUTH_ALLOWLIST).toHaveLength(9);
  });

  it("should NOT include /api/chatbot (human decision 2026-09-02, F-018 finding 2)", () => {
    expect(API_AUTH_ALLOWLIST).not.toContain("/api/chatbot");
  });
});

describe("requiresApiAuth — the gate's verdict (contract table, 27 cases)", () => {
  it.each([
    ["/api/negocio", true],
    ["/api/negocio/", true],
    ["//api/negocio", true],
    ["/api//negocio", true],
    ["/api/../api/negocio", true],
    ["/api/app/../negocio", true],
    ["/api/./negocio", true],
    ["/api/publico-falso", true],
    ["/api/appearance", true],
    ["/api/authors", true],
    ["/api/backup", true],
    ["/api/backup/otro", true],
    ["/api", true],
    ["/api/AUTH/session", true],
    ["/api/%2561pp/health", true],
    ["/api/%zz/negocio", true],
    ["/api/auth", false],
    ["/api/auth/", false],
    ["/api/auth/session", false],
    ["/api/app/health", false],
    ["/api/app/auth/login", false],
    ["/api/backup/generate", false],
    ["/api/promoters/self-enroll", false],
    ["/pos", false],
    ["/api/../pos", false],
    ["/", false],
    ["", false],
    ["/api/%c0%afnegocio", true],
    ["/api/app/%c0%afsubruta", false],
    ["/api/negocio/../../pos", false],
  ])("requiresApiAuth(%s) should be %s", (input, expected) => {
    expect(requiresApiAuth(input)).toBe(expected);
  });

  it("should never throw regardless of malformed percent-encoding", () => {
    expect(() => requiresApiAuth("/api/%zz/negocio")).not.toThrow();
    expect(() => requiresApiAuth("/api/%c0%afnegocio")).not.toThrow();
  });

  describe("the asymmetry invariant: normalizing more can only gate more, never permit more", () => {
    it("should gate a path that only LOOKS like an allowlist entry after aggressive decoding", () => {
      // Loose form of /api/%2561pp/health is /api/app/health (looks allowlisted), but the
      // strict form (what actually decides permission) is the literal, undecoded string, which
      // matches no allowlist entry. If this ever flips to `false`, the allowlist has started
      // permitting based on the loose form, which is exactly the bug ADR 0017 exists to prevent.
      const path = "/api/%2561pp/health";
      expect(toLoosePath(path)).toBe("/api/app/health");
      expect(isAllowlistedApiPath(path)).toBe(false);
      expect(requiresApiAuth(path)).toBe(true);
    });

    it("should gate a case-mangled attempt at an allowlisted entry", () => {
      // Uppercasing must not buy entry into the allowlist, even though it IS still recognized
      // as an API path (isApiPath uses the loose/lowercased form).
      const path = "/api/AUTH/session";
      expect(isApiPath(path)).toBe(true);
      expect(isAllowlistedApiPath(path)).toBe(false);
      expect(requiresApiAuth(path)).toBe(true);
    });

    it("should never grant isAllowlistedApiPath(true) without isApiPath(true) also being true", () => {
      // Every allowlist entry lives under /api, so anything the strict form recognizes as
      // allowlisted must also be recognized by the loose form as an API path. This is what
      // makes `requiresApiAuth = isApiPath && !isAllowlistedApiPath` a safe formula: the
      // allowlist can never widen what counts as "not API".
      const candidatePaths = [
        "/api/auth",
        "/api/app/health",
        "/api/backup/generate",
        "/api/promoters/self-enroll",
        "/api/negocio",
        "/api/publico-falso",
        "/pos",
        "/",
      ];
      for (const path of candidatePaths) {
        if (isAllowlistedApiPath(path)) {
          expect(isApiPath(path)).toBe(true);
        }
      }
    });
  });
});
