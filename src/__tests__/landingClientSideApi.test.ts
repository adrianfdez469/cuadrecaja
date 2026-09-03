import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * F-018 regression — criterion 9 human walkthrough.
 *
 * What broke: `/` mounted `PricingSection`, which called `getPlanes()` (from
 * `@/services/planService`, which calls `@/lib/axiosClient`) in a `useEffect`. That request
 * hit `GET /api/planes`, which the F-018 auth gate correctly answers with 401 because
 * `/api/planes` is not on the allowlist — it is meant to stay closed as an administration
 * endpoint. `axiosClient`'s response interceptor (`src/lib/axiosClient.ts`) converts EVERY
 * 401, from anywhere in the app, into `signOut({ callbackUrl: "/login" })`. So every
 * anonymous visitor of the public landing got signed out and bounced to `/login`.
 *
 * The fix (`src/app/page.tsx`, `src/lib/planes.ts`) made the landing a Server Component that
 * reads plans straight from the database with ISR and hands them down as props. The invariant
 * that fix depends on, and the one this test protects, is: **nothing the public landing
 * renders on the client may reach the authenticated API** — not `/api/planes` specifically,
 * any authenticated endpoint. A test that only checked "`listActivePlans()` returns plans" or
 * "`GET /` returns 200" would not have caught this: the bug was in a client-side network call
 * a unit test of the data layer never makes, and the redirect happened in the browser, not in
 * the page's HTTP status.
 *
 * This is deliberately a source-content test, not a rendering test: this project has no
 * `@testing-library/react`, and the failure mode being guarded against — a `useEffect` firing
 * an authenticated call from a public page — is invisible to `tsc` and to a snapshot of
 * rendered markup. Scanning imports is the cheapest thing that actually re-creates the failure
 * condition (an authenticated call reachable from the client) without spinning up a browser.
 *
 * Scope, chosen deliberately narrow: this bans `@/lib/axiosClient` and `@/services/planService`
 * specifically — the client that carries the dangerous interceptor, and the one existing
 * service that already wraps it for plans — not "any network call". `TrialForm.tsx`, in the
 * same directory, calls `fetch("/api/contact-form")` directly and that is correct: that
 * endpoint is one of the nine allowlist entries and a public, unauthenticated `POST` a visitor
 * must be able to make. Banning `fetch` too would break that legitimate case for no safety
 * gain, since a bare `fetch` never runs through the interceptor that causes the sign-out.
 *
 * Detection is by RESOLVED MODULE, not by specifier text. A first version compared the
 * specifier string against the literal `@/...` alias, which a `qa` mutation defeated: the exact
 * same forbidden import, written as `../../services/planService` instead of
 * `@/services/planService`, resolved to the identical file but didn't match the alias string, so
 * `tsc`, `lint` and this suite all stayed green. The fix is to resolve every specifier — alias or
 * relative — against the file that contains it and compare the resulting absolute module path,
 * extension stripped, to the forbidden modules' own resolved paths. That closes the alias-text
 * loophole for any relative specifier that reaches the same file, at any depth.
 */

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_DIR, "..");

/** Strips a source-file extension so `foo.ts`, `foo.tsx` and bare `foo` compare equal. */
function stripSourceExtension(absoluteModulePath: string): string {
  return absoluteModulePath.replace(/\.(ts|tsx|js|jsx)$/i, "");
}

const FORBIDDEN_MODULES = [
  {
    alias: "@/lib/axiosClient",
    resolvedTarget: stripSourceExtension(path.join(SRC_DIR, "lib/axiosClient")),
  },
  {
    alias: "@/services/planService",
    resolvedTarget: stripSourceExtension(
      path.join(SRC_DIR, "services/planService"),
    ),
  },
] as const;

// Matches the module specifier of a static import (`from "..."`), a dynamic
// import (`import("...")`), or a `require("...")` — whatever quote style is used.
// Deliberately anchored to one of those three keywords so a comment that merely
// *mentions* one of the forbidden module paths (explaining why it's banned, say)
// is not mistaken for an actual import.
const IMPORT_SPECIFIER_PATTERN =
  /(?:from\s+|import\(\s*|require\(\s*)["'`]([^"'`]+)["'`]/g;

/**
 * Resolves a module specifier to an absolute path, the same way Node/webpack would from the
 * given containing file: `@/...` maps to `SRC_DIR/...` (this project's only alias, per
 * `tsconfig.json`); `./` and `../` resolve relative to the containing file's directory,
 * regardless of how many levels it climbs. A bare package specifier (`"react"`, `"next/link"`)
 * resolves to `null` — it can never point at one of our own forbidden modules, so it is skipped
 * rather than mismatched against them.
 */
function resolveSpecifierToAbsoluteModule(
  specifier: string,
  containingFilePath: string,
): string | null {
  if (specifier.startsWith("@/")) {
    return stripSourceExtension(path.join(SRC_DIR, specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    return stripSourceExtension(
      path.resolve(path.dirname(containingFilePath), specifier),
    );
  }
  return null;
}

/**
 * Pure by design (no filesystem access — path arithmetic only), so it can be exercised directly
 * against fixture strings below without touching the filesystem — that is what lets this test's
 * own detection logic be verified independently of whatever the real landing files currently
 * contain. `containingFilePath` need not exist on disk; it only anchors relative-specifier
 * resolution, exactly as a bundler would use the importing file's own path.
 */
function extractForbiddenImports(
  source: string,
  containingFilePath: string,
): string[] {
  const found: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1];
    const resolved = resolveSpecifierToAbsoluteModule(
      specifier,
      containingFilePath,
    );
    if (resolved === null) {
      continue;
    }
    const forbidden = FORBIDDEN_MODULES.find(
      (module) => module.resolvedTarget === resolved,
    );
    if (forbidden) {
      found.push(forbidden.alias);
    }
  }
  return found;
}

function listSourceFilesRecursively(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return listSourceFilesRecursively(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function findForbiddenImports(filePath: string): string[] {
  return extractForbiddenImports(readFileSync(filePath, "utf-8"), filePath);
}

function buildFailureMessage(relativePath: string, offending: string[]): string {
  return [
    `${relativePath} imports ${offending.join(", ")}.`,
    "",
    "This recreates the F-018 criterion-9 regression: '/' is a public, anonymous page. Any",
    "module it renders on the client that reaches the authenticated API — directly through",
    "@/lib/axiosClient, or indirectly through a service like @/services/planService that",
    "wraps it — will get a 401 from the API auth gate, because a public page has no session",
    "cookie and the endpoint it's calling is not on the allowlist. axiosClient's response",
    "interceptor turns EVERY 401 into signOut({ callbackUrl: \"/login\" }), so the anonymous",
    "visitor gets signed out and bounced to /login. This bit /api/planes first, but it is not",
    "specific to that endpoint: it is any authenticated call reachable from this page.",
    "",
    "Fix: read the data on the server instead and pass it down as a prop — see how",
    "src/app/page.tsx reads src/lib/planes.ts and hands the result to PricingSection. A direct,",
    "unauthenticated fetch() to an allowlisted public endpoint (e.g. TrialForm's",
    "fetch(\"/api/contact-form\")) is fine: it is axiosClient's interceptor that is dangerous",
    "here, not HTTP calls in general.",
  ].join("\n");
}

const APP_DIR = path.resolve(TEST_DIR, "../app");
const LANDING_COMPONENTS_DIR = path.join(APP_DIR, "landing-components");
const LANDING_PAGE_FILE = path.join(APP_DIR, "page.tsx");

const filesUnderTest = [
  ...listSourceFilesRecursively(LANDING_COMPONENTS_DIR),
  LANDING_PAGE_FILE,
].map((absolutePath) => ({
  absolutePath,
  relativePath: path.relative(path.resolve(TEST_DIR, "../.."), absolutePath),
}));

describe("Public landing must never reach the authenticated API from the client (F-018 regression)", () => {
  it("should have actually found landing source files to scan", () => {
    // Guards the guard: if `landing-components/` or `page.tsx` ever moved or got renamed,
    // `listSourceFilesRecursively` would silently return an empty array and every
    // `it.each` below would just not run — a suite that looks green without asserting
    // anything. This fails loudly instead.
    expect(filesUnderTest.length).toBeGreaterThanOrEqual(10);
    expect(
      filesUnderTest.some((file) => file.absolutePath === LANDING_PAGE_FILE),
    ).toBe(true);
  });

  it.each(filesUnderTest)(
    "should not import the axios-gated API client in $relativePath",
    ({ absolutePath, relativePath }) => {
      const offending = findForbiddenImports(absolutePath);
      expect(offending, buildFailureMessage(relativePath, offending)).toEqual(
        [],
      );
    },
  );

  describe("extractForbiddenImports (the scanner itself)", () => {
    // A stand-in for the real PricingSection.tsx path, used only to anchor relative-specifier
    // resolution — it need not exist on disk. `landing-components/` is two levels below `src/`,
    // matching the real file's location.
    const FAKE_PRICING_SECTION_FILE = path.join(
      SRC_DIR,
      "app/landing-components/PricingSection.tsx",
    );
    // A deeper stand-in, three levels below `src/`, to prove resolution isn't hardcoded to one
    // specific climb depth.
    const FAKE_NESTED_WIDGET_FILE = path.join(
      SRC_DIR,
      "app/landing-components/nested/Widget.tsx",
    );

    it("should flag a default import of the axios client", () => {
      expect(
        extractForbiddenImports(
          `import axiosClient from "@/lib/axiosClient";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/lib/axiosClient"]);
    });

    it("should flag a named import of the plan service, single-quoted", () => {
      expect(
        extractForbiddenImports(
          `import { getPlanes } from '@/services/planService';`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/services/planService"]);
    });

    it("should flag a type-only import", () => {
      expect(
        extractForbiddenImports(
          `import type { RetryConfig } from "@/lib/axiosClient";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/lib/axiosClient"]);
    });

    it("should flag a dynamic import", () => {
      expect(
        extractForbiddenImports(
          `const mod = await import("@/lib/axiosClient");`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/lib/axiosClient"]);
    });

    it("should flag a require() call", () => {
      expect(
        extractForbiddenImports(
          `const svc = require("@/services/planService");`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/services/planService"]);
    });

    // Regression for the `qa` mutation-testing finding on F-018: the exact same forbidden
    // import, written with a relative specifier instead of the `@/` alias, resolves to the same
    // file and must be caught just the same. Before this fix, the alias-text comparison let this
    // through with tsc clean, lint clean and the suite green.
    it("should flag the plan service import written as a relative specifier (qa mutation)", () => {
      expect(
        extractForbiddenImports(
          `import { getPlanes } from "../../services/planService";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/services/planService"]);
    });

    it("should flag the axios client import written as a relative specifier", () => {
      expect(
        extractForbiddenImports(
          `import axiosClient from "../../lib/axiosClient";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/lib/axiosClient"]);
    });

    it("should flag a relative specifier that reaches the plan service from deeper nesting", () => {
      expect(
        extractForbiddenImports(
          `import { getPlanes } from "../../../services/planService";`,
          FAKE_NESTED_WIDGET_FILE,
        ),
      ).toEqual(["@/services/planService"]);
    });

    it("should flag a relative specifier written with a redundant ./ segment", () => {
      expect(
        extractForbiddenImports(
          `import { getPlanes } from "../../services/./planService";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual(["@/services/planService"]);
    });

    it("should NOT flag TrialForm's direct fetch to the allowlisted contact-form endpoint", () => {
      expect(
        extractForbiddenImports(
          `fetch("/api/contact-form", { method: "POST" })`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual([]);
    });

    it("should NOT flag an unrelated import from @/services or @/lib", () => {
      expect(
        extractForbiddenImports(
          [
            `import { buildPlanLimits } from "@/utils/planUtils";`,
            `import { prisma } from "@/lib/prisma";`,
          ].join("\n"),
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual([]);
    });

    it("should NOT flag a relative import of an unrelated sibling module", () => {
      expect(
        extractForbiddenImports(
          `import { buildPlanLimits } from "../../utils/planUtils";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual([]);
    });

    it("should NOT flag a bare package specifier", () => {
      expect(
        extractForbiddenImports(
          `import axios from "axios";`,
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual([]);
    });

    it("should NOT flag a comment that merely mentions the forbidden module path", () => {
      expect(
        extractForbiddenImports(
          "// Never import @/lib/axiosClient here — see F-018.",
          FAKE_PRICING_SECTION_FILE,
        ),
      ).toEqual([]);
    });
  });
});
