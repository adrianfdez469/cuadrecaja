import { describe, it, expect } from "vitest";
import {
  qabSlugSchema,
  openingHoursSchema,
  tiendaOnlineSchema,
  qabStorePayloadSchema,
} from "@/schemas/qabStore";
import {
  QAB_UNPUBLISH_REASON_MAX_LENGTH,
  QAB_CHECKOUT_MODE_DEFAULT,
  QAB_DELIVERY_ENABLED_DEFAULT,
  QAB_DELIVERY_FEE_MODE_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_DEFAULT,
} from "@/constants/qab";

/**
 * F-001/F-005 — the online-store block of a Tienda.
 *
 * Two contract constraints carry real weight here:
 *
 *  - `motivoDespublicacion` (unpublishReason) is plain text of at most 160 characters, and it
 *    wears a double guard: @db.VarChar(160) in the database and .max(160) in Zod. This file
 *    verifies the Zod half; the database half is qa's, in SQL.
 *  - `horarios` (openingHours) was OPAQUE in F-001 (Json?, no published shape). F-005 fixes the
 *    v9 format: `openingHoursSchema` now re-exports `@/schemas/qabOpeningHours`'s schema, and
 *    `tiendaOnlineSchema.horarios` is `openingHoursSchema.nullable()`. The exhaustive validation
 *    rules (17 issue codes, check order) live in `qabOpeningHours.test.ts`; this file only
 *    checks the RE-EXPORT wiring and that `tiendaOnlineSchema` composes it correctly.
 */

const validCalendar = {
  version: 1,
  days: { mon: [{ from: "09:00", to: "17:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
};

const baseTiendaOnline = {
  publicarEnTienda: true,
  slug: "tienda-demo",
  slugQab: "tienda-demo-2",
  descripcion: "Tienda de demostracion",
  direccion: "Calle 23 #456",
  ciudad: "La Habana",
  provincia: "La Habana",
  latitud: 23.1136,
  longitud: -82.3666,
  telefono: "+5350000000",
  whatsapp: "+5350000000",
  email: "tienda@example.com",
  horarios: validCalendar,
  motivoDespublicacion: "Cerrado por inventario",
  // F-016: the five purchase-configuration columns, required in this schema (it mirrors
  // the Tienda row shape, not the STORE payload's omission rule).
  checkoutMode: QAB_CHECKOUT_MODE_DEFAULT,
  deliveryEnabled: QAB_DELIVERY_ENABLED_DEFAULT,
  deliveryFee: null,
  deliveryFeeMode: QAB_DELIVERY_FEE_MODE_DEFAULT,
  orderExpiryHours: QAB_ORDER_EXPIRY_HOURS_DEFAULT,
};

describe("qabSlugSchema", () => {
  const acceptedSlugs: string[] = [
    "tienda-demo",
    "tienda",
    "t",
    "tienda2",
    "2tiendas",
    "mi-tienda-de-barrio",
    "a".repeat(80),
  ];

  it.each(acceptedSlugs)("should accept the slug %s", (slug) => {
    expect(qabSlugSchema.parse(slug)).toBe(slug);
  });

  const invalidSlugs: Array<[string, unknown]> = [
    ["an uppercase slug with spaces", "Tienda Demo"],
    ["an uppercase slug", "TiendaDemo"],
    ["an underscore separator", "tienda_demo"],
    ["a leading hyphen", "-a"],
    ["a trailing hyphen", "a-"],
    ["a double hyphen", "a--b"],
    ["an empty slug", ""],
    ["a blank slug", " "],
    ["a slug with an accent", "tienda-demá"],
    ["a slug with a dot", "tienda.demo"],
    ["a slug with a slash", "tienda/demo"],
    ["a slug longer than 80 characters", "a".repeat(81)],
    ["null", null],
    ["undefined", undefined],
    ["a number", 1],
    ["an object", {}],
  ];

  it.each(invalidSlugs)("should reject %s", (_label, value) => {
    expect(qabSlugSchema.safeParse(value).success).toBe(false);
  });
});

describe("openingHoursSchema — re-export of @/schemas/qabOpeningHours (F-005)", () => {
  // The exhaustive rules (17 issue codes, check order, byte cap) belong to
  // `qabOpeningHours.test.ts`. This only confirms qabStore.ts wires the SAME schema through,
  // rather than a second, drifted copy of it.
  it("should accept a well formed v9 calendar", () => {
    expect(openingHoursSchema.safeParse(validCalendar).success).toBe(true);
  });

  it("should reject a shape that F-001's opaque schema used to accept without complaint", () => {
    // Pre-F-005, `{ mon: ["09:00", "17:00"] }` parsed fine because the schema was z.unknown().
    // If this still passes, qabStore.ts never switched to the real v9 validator.
    expect(openingHoursSchema.safeParse({ mon: ["09:00", "17:00"] }).success).toBe(false);
  });

  it("should reject a calendar with an invalid version", () => {
    expect(openingHoursSchema.safeParse({ version: 2, days: validCalendar.days }).success).toBe(false);
  });
});

describe("tiendaOnlineSchema", () => {
  it("should accept a complete online-store block", () => {
    const parsed = tiendaOnlineSchema.parse(baseTiendaOnline);

    expect(parsed).toMatchObject({
      publicarEnTienda: true,
      slug: "tienda-demo",
      slugQab: "tienda-demo-2",
      email: "tienda@example.com",
    });
  });

  it("should accept null coordinates: a store may have no location yet", () => {
    const parsed = tiendaOnlineSchema.parse({
      ...baseTiendaOnline,
      latitud: null,
      longitud: null,
    });

    expect(parsed.latitud).toBeNull();
    expect(parsed.longitud).toBeNull();
  });

  const validCoordinates: Array<[string, number, number]> = [
    ["the north pole", 90, 0],
    ["the south pole", -90, 0],
    ["the antimeridian going east", 0, 180],
    ["the antimeridian going west", 0, -180],
    ["the null island", 0, 0],
  ];

  it.each(validCoordinates)("should accept %s", (_label, latitud, longitud) => {
    expect(tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, latitud, longitud }).success).toBe(
      true
    );
  });

  const invalidCoordinates: Array<[string, number, number]> = [
    ["a latitude above 90", 90.1, 0],
    ["a latitude below -90", -90.1, 0],
    ["a longitude above 180", 0, 180.1],
    ["a longitude below -180", 0, -180.1],
  ];

  it.each(invalidCoordinates)("should reject %s", (_label, latitud, longitud) => {
    expect(tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, latitud, longitud }).success).toBe(
      false
    );
  });

  it("should reject a latitude that is not a number", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, latitud: "23.1136" }).success
    ).toBe(false);
  });

  it("should reject a malformed email", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, email: "no-es-un-correo" }).success
    ).toBe(false);
  });

  it("should accept an unpublish reason of exactly 160 characters", () => {
    const motivoDespublicacion = "x".repeat(QAB_UNPUBLISH_REASON_MAX_LENGTH);

    const parsed = tiendaOnlineSchema.parse({ ...baseTiendaOnline, motivoDespublicacion });

    expect(parsed.motivoDespublicacion).toHaveLength(160);
  });

  it("should reject an unpublish reason of 161 characters", () => {
    const motivoDespublicacion = "x".repeat(QAB_UNPUBLISH_REASON_MAX_LENGTH + 1);

    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, motivoDespublicacion }).success
    ).toBe(false);
  });

  it("should keep QAB_UNPUBLISH_REASON_MAX_LENGTH at the 160 characters of the contract", () => {
    expect(QAB_UNPUBLISH_REASON_MAX_LENGTH).toBe(160);
  });

  it("should accept horarios: null — a local with no calendar configured yet", () => {
    expect(tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, horarios: null }).success).toBe(true);
  });

  it("should reject an invalid horarios calendar (F-005: no longer opaque)", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, horarios: { version: 2, days: {} } }).success
    ).toBe(false);
  });

  it("should not carry an unknown key through", () => {
    const parsed = tiendaOnlineSchema.parse({
      ...baseTiendaOnline,
      existencia: 40,
    });

    // The forbidden list of the contract: `existencia` must never travel to QAB.
    expect(parsed).not.toHaveProperty("existencia");
  });
});

/**
 * F-016 (contract § 4) — the five purchase-configuration columns. `tiendaOnlineSchema`
 * mirrors the `Tienda` row: all five are REQUIRED, and only `deliveryFee` is nullable — the
 * opposite rule from the STORE `payload` below, where all five are optional.
 */
describe("tiendaOnlineSchema — F-016 purchase configuration columns", () => {
  it("should accept a well formed configuration with a real deliveryFee", () => {
    expect(
      tiendaOnlineSchema.safeParse({
        ...baseTiendaOnline,
        checkoutMode: "ONSITE",
        deliveryEnabled: true,
        deliveryFee: 150,
        deliveryFeeMode: "QUOTED_PER_ORDER",
        orderExpiryHours: 48,
      }).success
    ).toBe(true);
  });

  it("should accept deliveryFee: null — the one nullable key of the five", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, deliveryFee: null }).success
    ).toBe(true);
  });

  it.each(["checkoutMode", "deliveryEnabled", "deliveryFeeMode", "orderExpiryHours"] as const)(
    "should reject null in %s — as a row it is never nullable",
    (field) => {
      expect(
        tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, [field]: null }).success
      ).toBe(false);
    }
  );

  it.each(["checkoutMode", "deliveryEnabled", "deliveryFee", "deliveryFeeMode", "orderExpiryHours"] as const)(
    "should reject a body missing %s — all five are required here",
    (field) => {
      const withoutField = { ...baseTiendaOnline } as Record<string, unknown>;
      delete withoutField[field];
      expect(tiendaOnlineSchema.safeParse(withoutField).success).toBe(false);
    }
  );

  it("should reject 12.345 as deliveryFee (three decimals, criterion 6)", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, deliveryFee: 12.345 }).success
    ).toBe(false);
  });

  it("should reject 0 and 8761 as orderExpiryHours (criterion 8)", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, orderExpiryHours: 0 }).success
    ).toBe(false);
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, orderExpiryHours: 8761 }).success
    ).toBe(false);
  });

  it("should reject ZONE_BASED — out of this feature's vocabulary (F-042 scope)", () => {
    expect(
      tiendaOnlineSchema.safeParse({ ...baseTiendaOnline, deliveryFeeMode: "ZONE_BASED" }).success
    ).toBe(false);
  });
});

/**
 * F-016 (contract § 4) — the same five in `qabStorePayloadSchema`, the OPPOSITE omission
 * rule: every one of the five is `.optional()`, and an absent key must leave the payload
 * unchanged (criterion 4 lives here at the schema level; the builder-level assertion is in
 * `qabStorePayload.test.ts`).
 */
describe("qabStorePayloadSchema — F-016 purchase configuration keys are OPTIONAL", () => {
  const basePayload = {
    storeId: "a3f1a1a1-1111-4111-8111-111111111111",
    businessId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    businessName: "Bodega Central",
    name: "Sucursal Vedado",
    slug: "sucursal-vedado",
    description: null,
    address: null,
    city: null,
    province: null,
    latitude: null,
    longitude: null,
    phone: null,
    whatsapp: null,
    email: null,
    publishToStore: true,
    unpublishReason: null,
    updatedAt: "2026-09-03T12:00:00.000Z",
  };

  it("should accept the payload with none of the five keys present at all — a routine event that changes nothing of the purchase configuration", () => {
    const result = qabStorePayloadSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      for (const key of [
        "checkoutMode",
        "deliveryEnabled",
        "deliveryFee",
        "deliveryFeeMode",
        "orderExpiryHours",
      ] as const) {
        expect(key in result.data).toBe(false);
      }
    }
  });

  it("should accept each of the five present on its own, with a valid value", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, checkoutMode: "ONSITE" }).success
    ).toBe(true);
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, deliveryEnabled: true }).success
    ).toBe(true);
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, deliveryFee: 150 }).success
    ).toBe(true);
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, deliveryFeeMode: "QUOTED_PER_ORDER" }).success
    ).toBe(true);
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, orderExpiryHours: 48 }).success
    ).toBe(true);
  });

  it("should accept deliveryFee: null — the only one of the five that is nullable", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, deliveryFee: null }).success
    ).toBe(true);
  });

  it.each(["checkoutMode", "deliveryEnabled", "deliveryFeeMode", "orderExpiryHours"] as const)(
    "should reject null in %s (criterion 5: only deliveryFee accepts null)",
    (field) => {
      expect(
        qabStorePayloadSchema.safeParse({ ...basePayload, [field]: null }).success
      ).toBe(false);
    }
  );

  it("should reject 12.345 as deliveryFee (criterion 6)", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, deliveryFee: 12.345 }).success
    ).toBe(false);
  });

  it("should reject 0 and 8761 as orderExpiryHours (criterion 8)", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, orderExpiryHours: 0 }).success
    ).toBe(false);
    expect(
      qabStorePayloadSchema.safeParse({ ...basePayload, orderExpiryHours: 8761 }).success
    ).toBe(false);
  });
});
