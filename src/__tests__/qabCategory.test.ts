import { describe, it, expect } from "vitest";
import { toQabCategoryColor, qabCategoryPayloadSchema, qabCategoryPayloadInputSchema } from "@/schemas/qabCategory";

/**
 * F-006 — `src/schemas/qabCategory.ts` (contract §3.2, ADR 0045). Acceptance
 * criterion 9: omitting `color` on the wire DELETES the column on the other
 * side, so cuadrecaja's bridge (`toQabCategoryColor`) maps a BLANK local value
 * (empty or whitespace) to an explicit `null` — never to an absent key, and
 * never to the literal string the merchant typed if it was blank.
 */

const VALID_BUSINESS_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const VALID_CATEGORY_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const OCCURRED_AT = "2026-09-04T10:00:00.000Z";

describe("toQabCategoryColor — the ONE bridge between NOT NULL local storage and a nullable, deletable wire field", () => {
  it("should pass a real colour through unchanged", () => {
    expect(toQabCategoryColor("#1E88E5")).toBe("#1E88E5");
  });

  it("should map the empty string to null — criterion 9's exact verification input", () => {
    expect(toQabCategoryColor("")).toBeNull();
  });

  it("should map a whitespace-only string to null, not to the literal spaces", () => {
    expect(toQabCategoryColor("   ")).toBeNull();
  });

  it("should map null to null", () => {
    expect(toQabCategoryColor(null)).toBeNull();
  });

  it("should map undefined to null", () => {
    expect(toQabCategoryColor(undefined)).toBeNull();
  });

  it("discriminating case: a non-blank value padded with whitespace travels RAW, untrimmed — the trim only decides blank-or-not, it never rewrites the value", () => {
    expect(toQabCategoryColor("  #FFF  ")).toBe("  #FFF  ");
  });
});

describe("qabCategoryPayloadSchema", () => {
  const validPayload = {
    categoryId: VALID_CATEGORY_ID,
    businessId: VALID_BUSINESS_ID,
    name: "Bebidas",
    color: "#1E88E5",
    updatedAt: OCCURRED_AT,
  };

  it("should accept a well-formed CATEGORY payload with a colour", () => {
    expect(qabCategoryPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("should accept color: null explicitly — criterion 9's exact shape", () => {
    expect(qabCategoryPayloadSchema.safeParse({ ...validPayload, color: null }).success).toBe(
      true
    );
  });

  it("should REJECT a payload where `color` is missing entirely — it is required-and-nullable, never optional (the STORE contact-field trap)", () => {
    const { color: _omitted, ...withoutColor } = validPayload;
    expect(qabCategoryPayloadSchema.safeParse(withoutColor).success).toBe(false);
  });

  it("should reject an empty name", () => {
    expect(qabCategoryPayloadSchema.safeParse({ ...validPayload, name: "" }).success).toBe(
      false
    );
  });

  it("should NOT declare a `slug` key — the other side derives and freezes it at creation, renaming never moves it", () => {
    expect(
      qabCategoryPayloadSchema.safeParse({ ...validPayload, slug: "bebidas" }).success
    ).toBe(false);
  });

  it("should reject a non-UUID businessId or categoryId", () => {
    expect(qabCategoryPayloadSchema.safeParse({ ...validPayload, businessId: "x" }).success).toBe(
      false
    );
    expect(qabCategoryPayloadSchema.safeParse({ ...validPayload, categoryId: "x" }).success).toBe(
      false
    );
  });

  it("should reject any other unknown key (.strict())", () => {
    expect(qabCategoryPayloadSchema.safeParse({ ...validPayload, extra: 1 }).success).toBe(false);
  });
});

describe("qabCategoryPayloadInputSchema", () => {
  const validInput = {
    negocioId: VALID_BUSINESS_ID,
    categoriaId: VALID_CATEGORY_ID,
    nombre: "Bebidas",
    color: "#1E88E5",
    occurredAt: new Date(OCCURRED_AT),
  };

  it("should accept the flat input shape", () => {
    expect(qabCategoryPayloadInputSchema.safeParse(validInput).success).toBe(true);
  });

  it("should accept a null color (raw) — mapping blank to null is the BUILDER's job, not this schema's", () => {
    expect(qabCategoryPayloadInputSchema.safeParse({ ...validInput, color: null }).success).toBe(
      true
    );
  });

  it("should accept an empty-string color (raw, unmapped) — this schema does not itself call toQabCategoryColor", () => {
    expect(qabCategoryPayloadInputSchema.safeParse({ ...validInput, color: "" }).success).toBe(
      true
    );
  });

  it("should reject an extra key (.strict())", () => {
    expect(
      qabCategoryPayloadInputSchema.safeParse({ ...validInput, businessId: VALID_BUSINESS_ID })
        .success
    ).toBe(false);
  });

  it("should reject a non-Date occurredAt", () => {
    expect(
      qabCategoryPayloadInputSchema.safeParse({ ...validInput, occurredAt: OCCURRED_AT }).success
    ).toBe(false);
  });
});
