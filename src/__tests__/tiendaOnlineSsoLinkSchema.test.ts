import { describe, it, expect } from "vitest";
import { tiendaOnlineSsoLinkSchema } from "@/schemas/tiendaOnline";

/**
 * F-009 — `tiendaOnlineSsoLinkSchema`, added to `src/schemas/tiendaOnline.ts` (§ 2.1 of the
 * contract). Kept in its OWN file rather than appended to the existing
 * `tiendaOnlineSchemas.test.ts`: that file already has cases in green from earlier features, and
 * a symbol this feature adds must not be able to drag them down at collection time while the
 * implementer is still writing it (E-019). A brand-new file failing whole is harmless; an old
 * one failing whole is not.
 *
 * ONE key on purpose (§ 2.1): the token itself is never re-exposed, so the browser never learns
 * the QAB origin by composing a URL from a bare token.
 */

describe("tiendaOnlineSsoLinkSchema", () => {
  it("should accept a response with a single absolute url", () => {
    const result = tiendaOnlineSsoLinkSchema.safeParse({
      url: "https://queandabuscando.example/admin/sso?token=abc",
    });
    expect(result.success).toBe(true);
  });

  it("should reject a non-url string", () => {
    expect(tiendaOnlineSsoLinkSchema.safeParse({ url: "not-a-url" }).success).toBe(false);
  });

  it("should reject a bare token instead of a full url", () => {
    // Guards against ever changing the response shape to { token } — the contract is explicit
    // that composing the URL client-side is exactly the mistake it avoids (ADR 0069).
    expect(tiendaOnlineSsoLinkSchema.safeParse({ token: "some.jwt.value" }).success).toBe(false);
  });

  it("should reject a second key riding alongside url (.strict())", () => {
    const result = tiendaOnlineSsoLinkSchema.safeParse({
      url: "https://queandabuscando.example/admin/sso?token=abc",
      token: "abc",
    });
    expect(result.success).toBe(false);
  });
});
