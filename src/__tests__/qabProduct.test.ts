import { describe, it, expect } from "vitest";
import { qabProductPriceSchema, qabProductPayloadSchema, qabProductPayloadInputSchema } from "@/schemas/qabProduct";

/**
 * F-006 — `src/schemas/qabProduct.ts` (contract §3.3). This is the schema that
 * carries the most acceptance criteria of the feature:
 *
 *  - Criterion 1/2: `barcodes` is a LIST, `[]` is valid, and the key `barcode`
 *    (singular) must never parse — the `.strict()` schema is what makes that
 *    structurally impossible instead of a thing to remember.
 *  - Criterion 4: a payload carrying `barcode` (singular, any value, `null`
 *    included) must be REJECTED by this schema.
 *  - Criterion 5: `price` accepts only a value already rounded to
 *    QAB_AMOUNT_DECIMALS — a caller that forgot `toQabPrice` fails loudly.
 *  - Criterion 8: none of the forbidden keys (costo, margen, existencia,
 *    proveedorId, Proveedor, Venta, MovimientoStock, CierrePeriodo, Usuario,
 *    Rol) can parse, because `.strict()` declares none of them.
 */

const VALID_UUID_1 = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const VALID_UUID_2 = "a3f1a1a1-1111-4111-8111-111111111111";
const VALID_UUID_3 = "b4f2b2b2-2222-4222-8222-222222222222";
const VALID_UUID_4 = "c5f3c3c3-3333-4333-8333-333333333333";
const OCCURRED_AT = "2026-09-04T10:00:00.000Z";

function validProductPayload(overrides: Record<string, unknown> = {}) {
  return {
    storeProductId: VALID_UUID_1,
    productId: VALID_UUID_2,
    businessId: VALID_UUID_3,
    storeId: VALID_UUID_4,
    localName: "Agua mineral 500 ml",
    barcodes: ["7501234567890"],
    localCategoryId: VALID_UUID_1,
    price: 1.5,
    currency: "CUP",
    canonicalProductId: null,
    imageUrl: null,
    publishToStore: true,
    updatedAt: OCCURRED_AT,
    ...overrides,
  };
}

describe("qabProductPriceSchema", () => {
  it("should accept a value already at QAB_AMOUNT_DECIMALS (2)", () => {
    expect(qabProductPriceSchema.safeParse(2.67).success).toBe(true);
  });

  it("should REJECT a value with more than 2 real decimals — a caller that forgot toQabPrice fails loudly, criterion 5", () => {
    expect(qabProductPriceSchema.safeParse(2.675).success).toBe(false);
  });

  it("should reject a negative price", () => {
    expect(qabProductPriceSchema.safeParse(-1).success).toBe(false);
  });

  it("should accept zero", () => {
    expect(qabProductPriceSchema.safeParse(0).success).toBe(true);
  });

  it("should reject a non-finite value", () => {
    expect(qabProductPriceSchema.safeParse(Number.NaN).success).toBe(false);
    expect(qabProductPriceSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
  });
});

describe("qabProductPayloadSchema — criteria 1/2: barcodes is a LIST, [] is valid, singular key is impossible", () => {
  it("should accept barcodes as a non-empty array", () => {
    expect(qabProductPayloadSchema.safeParse(validProductPayload()).success).toBe(true);
  });

  it("should accept barcodes: [] — a product with no barcode still publishes (criterion 2)", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ barcodes: [] })).success
    ).toBe(true);
  });

  it("should REJECT barcodes: null — [] means 'none', null is not the same thing", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ barcodes: null })).success
    ).toBe(false);
  });

  it("criterion 4: should REJECT a payload carrying the singular key `barcode`, ANY value including null, alongside a valid `barcodes`", () => {
    const withSingular = { ...validProductPayload(), barcode: null };
    expect(qabProductPayloadSchema.safeParse(withSingular).success).toBe(false);
  });

  it("criterion 4 variant: `barcode` with a real string value is rejected too, not just null", () => {
    const withSingular = { ...validProductPayload(), barcode: "7501234567890" };
    expect(qabProductPayloadSchema.safeParse(withSingular).success).toBe(false);
  });

  it("should reject a barcodes array containing an empty string element", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ barcodes: [""] })).success
    ).toBe(false);
  });
});

describe("qabProductPayloadSchema — criterion 8: the forbidden fields cannot parse, structurally", () => {
  const forbiddenKeys = [
    "costo",
    "margen",
    "existencia",
    "umbralBajo",
    "proveedorId",
    "Proveedor",
    "Venta",
    "MovimientoStock",
    "CierrePeriodo",
    "Usuario",
    "Rol",
  ];

  it.each(forbiddenKeys)("should reject a payload carrying the forbidden key '%s'", (key) => {
    const withForbidden = { ...validProductPayload(), [key]: "anything" };
    expect(qabProductPayloadSchema.safeParse(withForbidden).success).toBe(false);
  });

  it("should reject the panel-owned keys a PRODUCT event never carries: description, imageUrls, priceOverride, visible, featured", () => {
    for (const key of ["description", "imageUrls", "priceOverride", "visible", "featured"]) {
      const withPanelKey = { ...validProductPayload(), [key]: "anything" };
      expect(qabProductPayloadSchema.safeParse(withPanelKey).success).toBe(false);
    }
  });

  it("should reject any unknown key at all, in general (.strict())", () => {
    expect(
      qabProductPayloadSchema.safeParse({ ...validProductPayload(), somethingNew: 1 }).success
    ).toBe(false);
  });
});

describe("qabProductPayloadSchema — the rest of the shape", () => {
  it("should accept localCategoryId: null — a product may reference no category", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ localCategoryId: null })).success
    ).toBe(true);
  });

  it("should accept canonicalProductId: null — it is NOT a Producto.id, no relation, no FK", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ canonicalProductId: null })).success
    ).toBe(true);
  });

  it("imageUrl must be a key of the payload (singular) — cuadrecaja has no product image, so it always travels null", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ imageUrl: null })).success
    ).toBe(true);
  });

  it("should reject an empty localName", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ localName: "" })).success
    ).toBe(false);
  });

  it("should reject a currency that is not exactly 3 characters", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ currency: "US" })).success
    ).toBe(false);
  });

  it("should reject a non-UUID storeProductId/productId/businessId/storeId", () => {
    expect(
      qabProductPayloadSchema.safeParse(validProductPayload({ storeProductId: "not-a-uuid" }))
        .success
    ).toBe(false);
  });
});

describe("qabProductPayloadInputSchema", () => {
  function validInput(overrides: Record<string, unknown> = {}) {
    return {
      negocioId: VALID_UUID_1,
      productoTiendaId: VALID_UUID_2,
      tiendaId: VALID_UUID_3,
      productoId: VALID_UUID_4,
      nombre: "Agua mineral 500 ml",
      barcodes: ["7501234567890"],
      categoriaId: VALID_UUID_1,
      precio: 2.675,
      currencyCode: "CUP",
      productoCanonicoId: null,
      publicarEnTienda: true,
      occurredAt: new Date(OCCURRED_AT),
      ...overrides,
    };
  }

  it("should accept the flat input shape, precio RAW (unrounded) — the builder rounds it, this schema does not", () => {
    expect(qabProductPayloadInputSchema.safeParse(validInput()).success).toBe(true);
  });

  it("should accept barcodes: []", () => {
    expect(qabProductPayloadInputSchema.safeParse(validInput({ barcodes: [] })).success).toBe(
      true
    );
  });

  it("should accept categoriaId: null — a product without a category", () => {
    expect(
      qabProductPayloadInputSchema.safeParse(validInput({ categoriaId: null })).success
    ).toBe(true);
  });

  it("should reject an extra key (.strict()) — e.g. a smuggled businessId", () => {
    expect(
      qabProductPayloadInputSchema.safeParse({ ...validInput(), businessId: VALID_UUID_1 })
        .success
    ).toBe(false);
  });

  it("should reject a non-Date occurredAt", () => {
    expect(
      qabProductPayloadInputSchema.safeParse({ ...validInput(), occurredAt: OCCURRED_AT }).success
    ).toBe(false);
  });

  it("currencyCode is already-resolved plain text here — NOT validated as a wire currency code by this schema (the builder does that)", () => {
    expect(
      qabProductPayloadInputSchema.safeParse(validInput({ currencyCode: "US" })).success
    ).toBe(true);
  });
});
