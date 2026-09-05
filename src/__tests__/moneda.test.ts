import { describe, it, expect } from "vitest";
import { monedaAdminUpdateSchema } from "@/schemas/moneda";
import { QAB_CURRENCY_NAME_MAX_LENGTH, QAB_CURRENCY_SYMBOL_MAX_LENGTH } from "@/constants/qab";

/**
 * F-006 — `monedaAdminUpdateSchema` (`src/schemas/moneda.ts`, contract §6.6).
 * Acceptance criterion 20: hardens the body of `PUT /api/admin/monedas/[code]`,
 * which today validates `nombre`/`simbolo` with a bare `z.string().min(1)` and
 * whose value lands in a table GLOBAL to the platform, visible in the public
 * storefront of OTHER businesses. The verification is exactly what the spec
 * prescribes: a value that exceeds the cap, or contains a control/markup
 * character, must fail to parse — and a value within bounds must keep working.
 */

describe("monedaAdminUpdateSchema — the happy path is unaffected", () => {
  it("should accept a legitimate nombre and simbolo within both caps", () => {
    const result = monedaAdminUpdateSchema.safeParse({ nombre: "Dólar estadounidense", simbolo: "US$" });
    expect(result.success).toBe(true);
  });

  it("should still accept a PUT that only sends activo — a partial update must not be forced to resend text", () => {
    expect(monedaAdminUpdateSchema.safeParse({ activo: false }).success).toBe(true);
  });

  it("all three keys stay optional", () => {
    expect(monedaAdminUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("should accept a legitimate non-Latin symbol under the cap", () => {
    expect(monedaAdminUpdateSchema.safeParse({ simbolo: "₽" }).success).toBe(true);
  });
});

describe("monedaAdminUpdateSchema — criterion 20a: length caps", () => {
  it("should reject a nombre longer than QAB_CURRENCY_NAME_MAX_LENGTH", () => {
    const tooLong = "A".repeat(QAB_CURRENCY_NAME_MAX_LENGTH + 1);
    expect(monedaAdminUpdateSchema.safeParse({ nombre: tooLong }).success).toBe(false);
  });

  it("should accept a nombre exactly at QAB_CURRENCY_NAME_MAX_LENGTH", () => {
    const exact = "A".repeat(QAB_CURRENCY_NAME_MAX_LENGTH);
    expect(monedaAdminUpdateSchema.safeParse({ nombre: exact }).success).toBe(true);
  });

  it("should reject a simbolo longer than QAB_CURRENCY_SYMBOL_MAX_LENGTH", () => {
    const tooLong = "$".repeat(QAB_CURRENCY_SYMBOL_MAX_LENGTH + 1);
    expect(monedaAdminUpdateSchema.safeParse({ simbolo: tooLong }).success).toBe(false);
  });

  it("should accept a simbolo exactly at QAB_CURRENCY_SYMBOL_MAX_LENGTH", () => {
    const exact = "$".repeat(QAB_CURRENCY_SYMBOL_MAX_LENGTH);
    expect(monedaAdminUpdateSchema.safeParse({ simbolo: exact }).success).toBe(true);
  });

  it("the cap should be measured AFTER trimming, not before", () => {
    const padded = `  ${"A".repeat(QAB_CURRENCY_NAME_MAX_LENGTH)}  `;
    expect(monedaAdminUpdateSchema.safeParse({ nombre: padded }).success).toBe(true);
  });
});

describe("monedaAdminUpdateSchema — criterion 20b: forbidden characters (deny list)", () => {
  it("should reject a nombre containing an HTML tag", () => {
    expect(monedaAdminUpdateSchema.safeParse({ nombre: "<b>Dólar</b>" }).success).toBe(false);
  });

  it("should reject a nombre containing a C0 control character", () => {
    expect(monedaAdminUpdateSchema.safeParse({ nombre: "Dólar" }).success).toBe(false);
  });

  it("should reject a simbolo containing a zero-width character", () => {
    expect(monedaAdminUpdateSchema.safeParse({ simbolo: "U​S$" }).success).toBe(false);
  });

  it("should reject a nombre containing a quote or backslash", () => {
    expect(monedaAdminUpdateSchema.safeParse({ nombre: 'Dólar"' }).success).toBe(false);
    expect(monedaAdminUpdateSchema.safeParse({ nombre: "Dólar\\" }).success).toBe(false);
  });
});

describe("monedaAdminUpdateSchema — strictness and shape", () => {
  it("should reject an unknown key (.strict())", () => {
    expect(monedaAdminUpdateSchema.safeParse({ nombre: "USD", codigoQab: "x" }).success).toBe(
      false
    );
  });

  it("should reject a non-boolean activo", () => {
    expect(monedaAdminUpdateSchema.safeParse({ activo: "true" }).success).toBe(false);
  });
});
