import { describe, it, expect } from "vitest";
import {
  toSafeWhatsappUrl,
  qabWhatsappUrlSchema,
} from "@/schemas/qabWhatsappUrl";
import { QAB_ORDER_URL_MAX_LENGTH } from "@/constants/qab";

/**
 * F-012 — `src/schemas/qabWhatsappUrl.ts` (contract § 2.2, ADR 0066). PURE: no Prisma,
 * no React, and it imports only `zod` and `@/constants/qab` (E-028). `toSafeWhatsappUrl`
 * is THE definition — the response schema below and the detail mapper both call it, so
 * the rule is never paraphrased (E-014).
 *
 * The five causes of `null`, straight from the contract's own docstring, one case each:
 *   1. null/empty value
 *   2. longer than QAB_ORDER_URL_MAX_LENGTH (checked before parsing)
 *   3. does not start with "https://"
 *   4. `new URL(value)` throws
 *   5. hostname is not "wa.me"
 *
 * Case 3 is deliberately tested with a value whose HOST would otherwise be `wa.me`
 * (`http://wa.me/123`): a guard that checks only `.hostname` and forgets the scheme
 * would pass this string by accident, so this is not a vacuous case (E-008).
 */

describe("toSafeWhatsappUrl", () => {
  it("cause 1: returns null for a null value", () => {
    expect(toSafeWhatsappUrl(null)).toBeNull();
  });

  it("cause 1: returns null for an empty string", () => {
    expect(toSafeWhatsappUrl("")).toBeNull();
  });

  it("cause 2: returns null for a value longer than QAB_ORDER_URL_MAX_LENGTH", () => {
    const tooLong = `https://wa.me/${"1".repeat(QAB_ORDER_URL_MAX_LENGTH)}`;
    expect(tooLong.length).toBeGreaterThan(QAB_ORDER_URL_MAX_LENGTH);

    expect(toSafeWhatsappUrl(tooLong)).toBeNull();
  });

  it("cause 3: returns null when the value does not start with https:// — even though its host, once parsed, would be wa.me", () => {
    expect(toSafeWhatsappUrl("http://wa.me/123")).toBeNull();
  });

  it("cause 4: returns null when new URL(value) throws (no host to parse)", () => {
    expect(toSafeWhatsappUrl("https://")).toBeNull();
  });

  it("cause 5: returns null for a host that is not wa.me at all", () => {
    expect(toSafeWhatsappUrl("https://atacante.example/x")).toBeNull();
  });

  it("cause 5: returns null for userinfo smuggling — https://wa.me@atacante.example/ has hostname atacante.example, not wa.me", () => {
    expect(toSafeWhatsappUrl("https://wa.me@atacante.example/")).toBeNull();
  });

  it("cause 5: returns null for a look-alike subdomain — https://wa.me.evil.com/x", () => {
    expect(toSafeWhatsappUrl("https://wa.me.evil.com/x")).toBeNull();
  });

  it("accepts a mixed-case host — https://WA.ME/123 — because URL lowercases the hostname before the comparison", () => {
    expect(toSafeWhatsappUrl("https://WA.ME/123")).not.toBeNull();
  });

  it("accepts a bare wa.me origin with only a query string — https://wa.me?x=1 — the guard is by hostname, not a fixed https://wa.me/ prefix", () => {
    expect(toSafeWhatsappUrl("https://wa.me?x=1")).not.toBeNull();
  });

  it("returns the legitimate value IDENTICAL character to character to the input, never url.href", () => {
    // A raw, unencoded space in `text=` is what makes this test meaningful:
    // `new URL(...).href` percent-encodes it, so a function normalising via `.href`
    // instead of returning the input verbatim would fail this exact assertion.
    const raw = "https://wa.me/5355512345?text=Hola mundo";
    expect(new URL(raw).href).not.toBe(raw); // sanity: proves .href would have differed

    expect(toSafeWhatsappUrl(raw)).toBe(raw);
  });
});

describe("qabWhatsappUrlSchema", () => {
  it("accepts a well formed https://wa.me/... string", () => {
    expect(
      qabWhatsappUrlSchema.safeParse("https://wa.me/5355512345?text=Pedido")
        .success,
    ).toBe(true);
  });

  it("rejects a string whose host is not wa.me — the same rule as toSafeWhatsappUrl, not a second copy of it (E-014)", () => {
    expect(
      qabWhatsappUrlSchema.safeParse("https://atacante.example/x").success,
    ).toBe(false);
  });

  it("rejects null — this bare schema requires a string; `.nullable()` is applied only where it is used (tiendaOnlineOrderSchema)", () => {
    expect(qabWhatsappUrlSchema.safeParse(null).success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(qabWhatsappUrlSchema.safeParse("").success).toBe(false);
  });
});
