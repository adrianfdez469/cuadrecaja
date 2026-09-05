import { describe, it, expect } from "vitest";
import { qabOrdersPullUrl } from "@/lib/qab/qabEnv";
import { QAB_ORDERS_PULL_PATH } from "@/constants/qab";

/**
 * F-010 — `qabOrdersPullUrl` (contract § `qabEnv.ts`). New file, not an addition to
 * `qabEnv.test.ts` (F-002's `resolveQabBaseUrl` suite): per [E-019], this symbol does
 * not exist until the implementer adds it, and importing it on its own cannot drag
 * down an unrelated, already-green suite.
 *
 * The one rule this file exists to pin: `since` is OMITTED entirely when the
 * business has no cursor yet — never `since=` empty and never `since=null`. The
 * contract calls this out explicitly: QAB answers a `since` out of range with a
 * 500, and does not document what an empty one does.
 */

const BASE_URL = "https://qab.example";

describe("qabOrdersPullUrl", () => {
  it("should build the URL with since and limit when the business has a cursor", () => {
    const url = qabOrdersPullUrl(BASE_URL, { since: "42", limit: 100 });
    expect(url).toBe(`${BASE_URL}${QAB_ORDERS_PULL_PATH}?since=42&limit=100`);
  });

  it("should OMIT since entirely — never since= empty, never since=null — on a business's first ever pull", () => {
    const url = qabOrdersPullUrl(BASE_URL, { since: null, limit: 100 });
    expect(url).toBe(`${BASE_URL}${QAB_ORDERS_PULL_PATH}?limit=100`);
    expect(url).not.toContain("since=");
    expect(url).not.toContain("since=null");
  });

  it("should reflect the requested limit, whichever step of the retry ladder it is", () => {
    expect(qabOrdersPullUrl(BASE_URL, { since: null, limit: 10 })).toContain("limit=10");
    expect(qabOrdersPullUrl(BASE_URL, { since: null, limit: 1 })).toContain("limit=1");
  });

  it("should build the query through URLSearchParams, not hand concatenation", () => {
    // A same-length sanity check that would catch an accidental double "?" or a
    // stray "&" from hand-built string concatenation.
    const url = qabOrdersPullUrl(BASE_URL, { since: "42", limit: 100 });
    expect(url.match(/\?/g)).toHaveLength(1);
    expect(new URL(url).searchParams.get("since")).toBe("42");
    expect(new URL(url).searchParams.get("limit")).toBe("100");
  });
});
