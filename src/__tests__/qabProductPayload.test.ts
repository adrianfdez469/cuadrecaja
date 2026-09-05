import { describe, it, expect } from "vitest";
import { buildQabProductPayload, QabProductPayloadError } from "@/lib/qab/qabProductPayload";
import { qabProductPayloadSchema } from "@/schemas/qabProduct";
import type { IQabProductPayloadInput } from "@/schemas/qabProduct";
import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";

/**
 * F-006 — `buildQabProductPayload` (`src/lib/qab/qabProductPayload.ts`, contract
 * §4.1). Covers acceptance criteria 1, 2, 5 and 8 at the unit level: the wire
 * shape (schema conformance) is qabProduct.test.ts's job, this file covers what
 * the BUILDER does with a raw, persisted row — rounding, refusal, and mapping.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const PRODUCTO_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const TIENDA_ID = "b4f2b2b2-2222-4222-8222-222222222222";
const PRODUCTO_TIENDA_ID = "c5f3c3c3-3333-4333-8333-333333333333";
const OCCURRED_AT = new Date("2026-09-04T10:00:00.000Z");

function input(overrides: Partial<IQabProductPayloadInput> = {}): IQabProductPayloadInput {
  return {
    negocioId: NEGOCIO_ID,
    productoTiendaId: PRODUCTO_TIENDA_ID,
    tiendaId: TIENDA_ID,
    productoId: PRODUCTO_ID,
    nombre: "Agua mineral 500 ml",
    barcodes: ["7501234567890"],
    categoriaId: "d6f4d4d4-4444-4444-8444-444444444444",
    precio: 1.5,
    currencyCode: "CUP",
    productoCanonicoId: null,
    publicarEnTienda: true,
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

describe("buildQabProductPayload — criterion 5: price rounding via toQabPrice", () => {
  it("should round 2.675 to 2.67, never 2.68 or 2.675", () => {
    const payload = buildQabProductPayload(input({ precio: 2.675 }));
    expect(payload.price).toBe(2.67);
  });

  it("should round 2.005 to 2, the divergent-rounding case", () => {
    const payload = buildQabProductPayload(input({ precio: 2.005 }));
    expect(payload.price).toBe(2);
  });

  it("should serialise price as a JSON NUMBER, never a quoted string", () => {
    const payload = buildQabProductPayload(input({ precio: 2.675 }));
    expect(JSON.parse(JSON.stringify(payload)).price).toBe(2.67);
    expect(typeof JSON.parse(JSON.stringify(payload)).price).toBe("number");
  });

  it("should throw QabProductPayloadError with code priceInvalid for a negative price", () => {
    try {
      buildQabProductPayload(input({ precio: -1 }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabProductPayloadError);
      expect((error as QabProductPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.priceInvalid
      );
      expect((error as QabProductPayloadError).productoTiendaId).toBe(PRODUCTO_TIENDA_ID);
    }
  });

  it("should throw QabProductPayloadError with code priceInvalid for a non-finite price", () => {
    expect(() => buildQabProductPayload(input({ precio: Number.NaN }))).toThrow(
      QabProductPayloadError
    );
  });
});

describe("buildQabProductPayload — criterion (currency): refuses a malformed currency code before writing anything", () => {
  it("should throw QabProductPayloadError with code currencyCodeInvalid when currencyCode is not 3 characters", () => {
    try {
      buildQabProductPayload(input({ currencyCode: "US" }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabProductPayloadError);
      expect((error as QabProductPayloadError).code).toBe(
        QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid
      );
    }
  });
});

describe("buildQabProductPayload — criteria 1/2: barcodes travel as a list, [] is valid", () => {
  it("should carry barcodes through as-is when the product has codes", () => {
    const payload = buildQabProductPayload(input({ barcodes: ["111", "222"] }));
    expect(payload.barcodes).toEqual(["111", "222"]);
  });

  it("should carry barcodes: [] when the product has none — it publishes anyway (criterion 2)", () => {
    const payload = buildQabProductPayload(input({ barcodes: [] }));
    expect(payload.barcodes).toEqual([]);
  });

  it("should NEVER produce a `barcode` (singular) key", () => {
    const payload = buildQabProductPayload(input());
    expect("barcode" in payload).toBe(false);
  });
});

describe("buildQabProductPayload — criterion 8: no forbidden field ever reaches the payload", () => {
  it("should produce a payload whose only keys are the ones qabProductPayloadSchema declares — no spread of a Prisma row", () => {
    const payload = buildQabProductPayload(input());
    const allowedKeys = new Set(Object.keys(qabProductPayloadSchema.shape));
    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true);
    }
  });

  it("should build a valid payload even for a consignment product (input carries no proveedorId at all) — the input schema itself has nowhere to put it", () => {
    // The input shape (IQabProductPayloadInput) never declares `proveedorId`: this is what
    // makes it structurally impossible for a consignment product to leak Proveedor, the case
    // the spec calls out as most prone to filter it (criterion 8).
    const payload = buildQabProductPayload(input());
    expect(payload).not.toHaveProperty("proveedorId");
    expect(payload).not.toHaveProperty("costo");
    expect(payload).not.toHaveProperty("margen");
    expect(payload).not.toHaveProperty("existencia");
  });
});

describe("buildQabProductPayload — field mapping and imageUrl", () => {
  it("should map storeProductId/productId/businessId/storeId/localName/localCategoryId from the input columns", () => {
    const payload = buildQabProductPayload(input());

    expect(payload.storeProductId).toBe(PRODUCTO_TIENDA_ID);
    expect(payload.productId).toBe(PRODUCTO_ID);
    expect(payload.businessId).toBe(NEGOCIO_ID);
    expect(payload.storeId).toBe(TIENDA_ID);
    expect(payload.localName).toBe("Agua mineral 500 ml");
  });

  it("should always send imageUrl: null — cuadrecaja has no product image", () => {
    const payload = buildQabProductPayload(input());
    expect(payload.imageUrl).toBeNull();
  });

  it("should serialise updatedAt as occurredAt.toISOString()", () => {
    const payload = buildQabProductPayload(
      input({ occurredAt: new Date("2026-09-04T10:00:00.123Z") })
    );
    expect(payload.updatedAt).toBe("2026-09-04T10:00:00.123Z");
  });

  it("should map publicarEnTienda to publishToStore literally", () => {
    expect(buildQabProductPayload(input({ publicarEnTienda: true })).publishToStore).toBe(true);
    expect(buildQabProductPayload(input({ publicarEnTienda: false })).publishToStore).toBe(false);
  });

  it("should carry productoCanonicoId through as canonicalProductId, including null", () => {
    expect(buildQabProductPayload(input({ productoCanonicoId: null })).canonicalProductId).toBeNull();
    expect(
      buildQabProductPayload(input({ productoCanonicoId: "e7f5e5e5-5555-4555-8555-555555555555" }))
        .canonicalProductId
    ).toBe("e7f5e5e5-5555-4555-8555-555555555555");
  });

  it("should produce a payload that itself satisfies qabProductPayloadSchema (.strict())", () => {
    const payload = buildQabProductPayload(input());
    expect(qabProductPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
