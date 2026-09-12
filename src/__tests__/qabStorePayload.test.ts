import { describe, it, expect } from "vitest";
import {
  buildQabStorePayload,
  QabStorePayloadError,
  QabStorePurchaseConfigError,
} from "@/lib/qab/qabStorePayload";
import {
  qabStorePayloadSchema,
  qabStorePayloadInputSchema,
  type IQabStorePayloadInput,
} from "@/schemas/qabStore";
import { QAB_STORE_PURCHASE_CONFIG_KEYS } from "@/constants/qab";

/**
 * F-005 — `buildQabStorePayload` (`src/lib/qab/qabStorePayload.ts`, ADR 0032) and the wire
 * schema it produces (`src/schemas/qabStore.ts` §3). This is where the feature can silently
 * delete a merchant's data if it gets the two omission semantics backwards, so both directions
 * are asserted explicitly (spec §"Contexto necesario", regla 2), never just one (E-008):
 *
 *  - The nine contact fields are REQUIRED in the payload, with their current value even when
 *    that value is `null` — never omitted.
 *  - `openingHours` is the opposite: the KEY ITSELF is absent (not merely `undefined`-valued)
 *    when there is no calendar, and present only when there is one.
 */

const OCCURRED_AT = new Date("2026-09-03T12:00:00.000Z");

function input(overrides: Partial<IQabStorePayloadInput> = {}): IQabStorePayloadInput {
  return {
    negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    negocioNombre: "Bodega Central",
    tiendaId: "a3f1a1a1-1111-4111-8111-111111111111",
    nombre: "Sucursal Vedado",
    publicarEnTienda: true,
    slug: "sucursal-vedado",
    descripcion: "Bodega de barrio",
    direccion: "Calle 23 #456",
    ciudad: "La Habana",
    provincia: "La Habana",
    latitud: 23.1136,
    longitud: -82.3666,
    telefono: "+5350000000",
    whatsapp: "+5350000000",
    email: "sucursal@example.com",
    // F-006: `Negocio.monedaBase`, RAW. Required by qabStorePayloadInputSchema since this
    // feature added it (contract §3.4) — every F-005 fixture has to carry it now.
    monedaBase: "CUP",
    horarios: null,
    motivoDespublicacion: null,
    occurredAt: OCCURRED_AT,
    // F-016: what changed in THIS operation, contract §4/§5.1. Required by
    // qabStorePayloadInputSchema since this feature added it — every fixture in this file
    // now has to carry it, `{}` ("nothing changed") being the neutral default so every
    // pre-existing test in this file keeps asserting exactly what it asserted before.
    purchaseConfigChanges: {},
    ...overrides,
  };
}

const validCalendar = {
  version: 1,
  days: { mon: [{ from: "09:00", to: "17:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
};

describe("buildQabStorePayload — the nine contact fields are NEVER omitted", () => {
  it("should include all nine contact fields with their null value, when every one of them is null", () => {
    const payload = buildQabStorePayload(
      input({
        descripcion: null,
        direccion: null,
        ciudad: null,
        provincia: null,
        latitud: null,
        longitud: null,
        telefono: null,
        whatsapp: null,
        email: null,
      })
    );

    for (const key of [
      "description",
      "address",
      "city",
      "province",
      "latitude",
      "longitude",
      "phone",
      "whatsapp",
      "email",
    ] as const) {
      expect(payload).toHaveProperty(key);
      expect(payload[key]).toBeNull();
    }
  });

  it("should carry each contact field's real value through untouched", () => {
    const payload = buildQabStorePayload(input());

    expect(payload.description).toBe("Bodega de barrio");
    expect(payload.address).toBe("Calle 23 #456");
    expect(payload.city).toBe("La Habana");
    expect(payload.province).toBe("La Habana");
    expect(payload.latitude).toBe(23.1136);
    expect(payload.longitude).toBe(-82.3666);
    expect(payload.phone).toBe("+5350000000");
    expect(payload.whatsapp).toBe("+5350000000");
    expect(payload.email).toBe("sucursal@example.com");
  });

  it("this is the branch that would catch a broken builder that omits null fields: a PARTIALLY null local still carries every one of the nine keys", () => {
    // E-008 guard: mixing null and non-null contact fields in the SAME payload is what would
    // catch an implementation that special-cases "omit when null" for only some fields.
    const payload = buildQabStorePayload(
      input({ descripcion: null, telefono: null, email: "still-here@example.com" })
    );

    expect(payload).toHaveProperty("description");
    expect(payload.description).toBeNull();
    expect(payload).toHaveProperty("phone");
    expect(payload.phone).toBeNull();
    expect(payload.email).toBe("still-here@example.com");
  });
});

describe("buildQabStorePayload — openingHours is omitted BY KEY, the opposite rule", () => {
  it('should NOT include the "openingHours" key at all when horarios is null', () => {
    const payload = buildQabStorePayload(input({ horarios: null }));

    expect("openingHours" in payload).toBe(false);
  });

  it('should NOT include the "openingHours" key at all when horarios is undefined', () => {
    const payload = buildQabStorePayload(input({ horarios: undefined }));

    expect("openingHours" in payload).toBe(false);
  });

  it("this is the branch that proves the key is truly absent, not merely undefined: JSON.stringify must not mention it either", () => {
    // E-008 guard: `payload.openingHours === undefined` is also true for `{openingHours:
    // undefined}`, which is NOT the same as the key never having been set — only
    // JSON.stringify (or `"openingHours" in payload`) tells them apart, and the wire only ever
    // sees the JSON-serialised form.
    const payload = buildQabStorePayload(input({ horarios: null }));

    expect(JSON.stringify(payload)).not.toContain("openingHours");
  });

  it("should include a validated openingHours key when horarios holds a valid calendar", () => {
    const payload = buildQabStorePayload(input({ horarios: validCalendar }));

    expect("openingHours" in payload).toBe(true);
    expect(payload.openingHours).toEqual(validCalendar);
  });

  it("this is the branch contrasting the two omission semantics directly: same call, contact fields present, openingHours absent", () => {
    // Both rules verified in ONE payload, so a builder that confuses the two semantics (e.g.
    // omits contact fields too, or always includes openingHours as null) fails this test.
    const payload = buildQabStorePayload(input({ horarios: null, descripcion: null }));

    expect(payload).toHaveProperty("description");
    expect(payload.description).toBeNull();
    expect("openingHours" in payload).toBe(false);
  });
});

describe("buildQabStorePayload — throws QabStorePayloadError on an invalid calendar, never emits a partial event", () => {
  it("should throw QabStorePayloadError when horarios does not validate", () => {
    expect(() => buildQabStorePayload(input({ horarios: { version: 2, days: {} } }))).toThrow(
      QabStorePayloadError
    );
  });

  it("should carry the coded issues on the thrown error", () => {
    try {
      buildQabStorePayload(input({ horarios: { version: 2, days: {} } }));
      expect.unreachable("must throw");
    } catch (error) {
      expect(error).toBeInstanceOf(QabStorePayloadError);
      const issues = (error as InstanceType<typeof QabStorePayloadError>).issues;
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some((issue) => issue.code === "VERSION_INVALID")).toBe(true);
    }
  });

  it("a timezone key inside horarios rejects the WHOLE calendar (it never reaches the payload)", () => {
    const withTimezone = {
      version: 1,
      days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      timezone: "America/Havana",
    };

    expect(() => buildQabStorePayload(input({ horarios: withTimezone }))).toThrow(
      QabStorePayloadError
    );
  });
});

describe("buildQabStorePayload — no timezone key, anywhere", () => {
  it("should never produce a top-level timezone key", () => {
    const payload = buildQabStorePayload(input({ horarios: validCalendar }));

    expect(payload).not.toHaveProperty("timezone");
    expect(JSON.stringify(payload)).not.toContain("timezone");
  });
});

describe("buildQabStorePayload — unpublishReason follows publishToStore, not the raw field", () => {
  it("should carry the motivo through when publicarEnTienda is false", () => {
    const payload = buildQabStorePayload(
      input({ publicarEnTienda: false, motivoDespublicacion: "Cerrado por inventario" })
    );

    expect(payload.publishToStore).toBe(false);
    expect(payload.unpublishReason).toBe("Cerrado por inventario");
  });

  it("should force unpublishReason to null when publicarEnTienda is true, even if a motivo lingers on the row", () => {
    // The contract is explicit: QAB ignores unpublishReason when publishToStore is true, and
    // the builder is the one place that has to enforce it is null there, not just "whatever
    // the field happened to hold".
    const payload = buildQabStorePayload(
      input({ publicarEnTienda: true, motivoDespublicacion: "Motivo antiguo, ya no aplica" })
    );

    expect(payload.publishToStore).toBe(true);
    expect(payload.unpublishReason).toBeNull();
  });
});

describe("buildQabStorePayload — field mapping", () => {
  it("should map storeId/businessId/businessName/name/slug from the input columns", () => {
    const payload = buildQabStorePayload(input());

    expect(payload.storeId).toBe("a3f1a1a1-1111-4111-8111-111111111111");
    expect(payload.businessId).toBe("8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e");
    expect(payload.businessName).toBe("Bodega Central");
    expect(payload.name).toBe("Sucursal Vedado");
    expect(payload.slug).toBe("sucursal-vedado");
  });

  it("should serialise updatedAt as occurredAt.toISOString(), milliseconds included", () => {
    const payload = buildQabStorePayload(input({ occurredAt: new Date("2026-09-03T12:00:00.123Z") }));

    expect(payload.updatedAt).toBe("2026-09-03T12:00:00.123Z");
  });

  it("should produce a payload that itself satisfies qabStorePayloadSchema (.strict())", () => {
    const payload = buildQabStorePayload(input({ horarios: validCalendar }));

    expect(qabStorePayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("buildQabStorePayload — baseCurrency, F-006 criterion 16", () => {
  it("should include baseCurrency resolved from Negocio.monedaBase when it is a well-formed 3-character code", () => {
    const payload = buildQabStorePayload(input({ monedaBase: "USD" }));

    expect(payload.baseCurrency).toBe("USD");
  });

  it("should update baseCurrency on a republish after the business changes its base currency", () => {
    const first = buildQabStorePayload(input({ monedaBase: "USD" }));
    const second = buildQabStorePayload(input({ monedaBase: "EUR" }));

    expect(first.baseCurrency).toBe("USD");
    expect(second.baseCurrency).toBe("EUR");
  });

  it("should DROP the baseCurrency key entirely (not send it as null/undefined) when monedaBase is not a well-formed wire code — a malformed base currency must not take the whole STORE event down (§4.4 asymmetry)", () => {
    const payload = buildQabStorePayload(input({ monedaBase: "US" }));

    expect("baseCurrency" in payload).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("baseCurrency");
  });

  it("should still build a valid, complete payload when baseCurrency is dropped — the rest of STORE is unaffected", () => {
    const payload = buildQabStorePayload(input({ monedaBase: "" }));

    expect("baseCurrency" in payload).toBe(false);
    expect(qabStorePayloadSchema.safeParse(payload).success).toBe(true);
  });
});

describe("qabStorePayloadSchema", () => {
  const validPayload = {
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

  it("should accept a payload with every contact field null and no openingHours key", () => {
    expect(qabStorePayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("should reject a payload missing one of the nine contact fields", () => {
    const { description: _omitted, ...withoutDescription } = validPayload;
    expect(qabStorePayloadSchema.safeParse(withoutDescription).success).toBe(false);
  });

  it("should reject an extra timezone key: the schema declares none, and it is .strict()", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...validPayload, timezone: "America/Havana" }).success
    ).toBe(false);
  });

  it("should accept openingHours when present and valid", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...validPayload, openingHours: validCalendar }).success
    ).toBe(true);
  });

  it("should accept baseCurrency absent — it is optional (contract §3.4)", () => {
    expect(qabStorePayloadSchema.safeParse(validPayload).success).toBe(true);
    expect("baseCurrency" in validPayload).toBe(false);
  });

  it("should accept a well-formed 3-character baseCurrency", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...validPayload, baseCurrency: "USD" }).success
    ).toBe(true);
  });

  it("should reject a baseCurrency that is not exactly 3 characters", () => {
    expect(
      qabStorePayloadSchema.safeParse({ ...validPayload, baseCurrency: "US" }).success
    ).toBe(false);
  });

  it("should reject a storeId that is not a UUID", () => {
    expect(qabStorePayloadSchema.safeParse({ ...validPayload, storeId: "not-a-uuid" }).success).toBe(
      false
    );
  });
});

describe("qabStorePayloadInputSchema", () => {
  it("should accept the full flat input shape", () => {
    expect(qabStorePayloadInputSchema.safeParse(input()).success).toBe(true);
  });

  it("should reject an extra key (.strict()) — e.g. a smuggled businessId", () => {
    const withExtra = { ...input(), businessId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e" };
    expect(qabStorePayloadInputSchema.safeParse(withExtra).success).toBe(false);
  });

  it("should NOT validate horarios itself: any value passes, validation is the builder's job", () => {
    expect(qabStorePayloadInputSchema.safeParse(input({ horarios: "anything at all" })).success).toBe(
      true
    );
  });

  it("should reject a non-Date occurredAt", () => {
    expect(
      qabStorePayloadInputSchema.safeParse({ ...input(), occurredAt: "2026-09-03T12:00:00.000Z" })
        .success
    ).toBe(false);
  });

  it("F-006: monedaBase is REQUIRED, not optional — a caller that forgets it fails to parse", () => {
    const { monedaBase: _omitted, ...withoutMonedaBase } = input();
    expect(qabStorePayloadInputSchema.safeParse(withoutMonedaBase).success).toBe(false);
  });

  it("F-006: monedaBase accepts the RAW column value even when malformed — the builder decides whether it can travel, not this schema", () => {
    expect(qabStorePayloadInputSchema.safeParse(input({ monedaBase: "US" })).success).toBe(true);
    expect(qabStorePayloadInputSchema.safeParse(input({ monedaBase: "" })).success).toBe(true);
  });

  it("F-016: purchaseConfigChanges is REQUIRED, never omitted — {} is the neutral value, not absence", () => {
    const { purchaseConfigChanges: _omitted, ...withoutChanges } = input();
    expect(qabStorePayloadInputSchema.safeParse(withoutChanges).success).toBe(false);
  });

  it("F-016: purchaseConfigChanges accepts the empty object and a partial delta, rejects an unknown key", () => {
    expect(qabStorePayloadInputSchema.safeParse(input({ purchaseConfigChanges: {} })).success).toBe(
      true
    );
    expect(
      qabStorePayloadInputSchema.safeParse(input({ purchaseConfigChanges: { orderExpiryHours: 48 } }))
        .success
    ).toBe(true);
    expect(
      qabStorePayloadInputSchema.safeParse(
        input({ purchaseConfigChanges: { zoneCode: "HAVANA" } as never })
      ).success
    ).toBe(false);
  });
});

/**
 * F-016 (contract §5.2, §0.1, ADR ADRIAN-0152) — "omitir no es apagar". This is the trap the
 * dev-tester briefing calls out first: a delta that changed NOTHING must leave the payload
 * BYTE-IDENTICAL to what F-005 already emits, and that is checked over `Object.keys`, never
 * over values — a payload that carried the five keys with their CURRENT (unchanged) values
 * would fail the actual criterion 4 just as badly as one that reset them to the defaults.
 */
describe("buildQabStorePayload — F-016 purchaseConfigChanges: omitting is not turning off", () => {
  it("criterion 4: an empty delta puts NONE of the five keys on the payload", () => {
    const payload = buildQabStorePayload(input({ purchaseConfigChanges: {} }));

    for (const key of QAB_STORE_PURCHASE_CONFIG_KEYS) {
      expect(key in payload).toBe(false);
    }
    expect(JSON.stringify(payload)).not.toMatch(
      /checkoutMode|deliveryEnabled|deliveryFeeMode|orderExpiryHours/
    );
  });

  it("criterion 3: a delta with exactly one changed key puts EXACTLY that key, flat, at the root", () => {
    const payload = buildQabStorePayload(
      input({ purchaseConfigChanges: { orderExpiryHours: 48 } })
    );

    expect(payload).toHaveProperty("orderExpiryHours", 48);
    for (const key of QAB_STORE_PURCHASE_CONFIG_KEYS) {
      if (key === "orderExpiryHours") continue;
      expect(key in payload).toBe(false);
    }
  });

  it("criterion 5: deliveryFee: null in the delta travels AS null, not omitted and not coerced", () => {
    const payload = buildQabStorePayload(input({ purchaseConfigChanges: { deliveryFee: null } }));

    expect("deliveryFee" in payload).toBe(true);
    expect(payload.deliveryFee).toBeNull();
    // Every other one of the five stays absent: this is the exact partial delta that reaches
    // QAB as a 207/STORE_DELIVERY_CONFIG_INCONSISTENT when the row already had delivery
    // enabled with a flat rate (contract §8) — our own builder must NOT reject it, since the
    // contradiction is only visible against the row QAB already has.
    expect("deliveryEnabled" in payload).toBe(false);
    expect("deliveryFeeMode" in payload).toBe(false);
  });

  it("should put every one of the five, each with its own value, when all five changed in the same operation", () => {
    const payload = buildQabStorePayload(
      input({
        purchaseConfigChanges: {
          checkoutMode: "ONSITE",
          deliveryEnabled: true,
          deliveryFee: 200,
          deliveryFeeMode: "QUOTED_PER_ORDER",
          orderExpiryHours: 72,
        },
      })
    );

    expect(payload).toMatchObject({
      checkoutMode: "ONSITE",
      deliveryEnabled: true,
      deliveryFee: 200,
      deliveryFeeMode: "QUOTED_PER_ORDER",
      orderExpiryHours: 72,
    });
  });

  it("a delta that changes purchase configuration keeps the nine contact fields' own rule untouched (present, even when null)", () => {
    const payload = buildQabStorePayload(
      input({ descripcion: null, purchaseConfigChanges: { orderExpiryHours: 48 } })
    );

    expect(payload).toHaveProperty("description");
    expect(payload.description).toBeNull();
    expect(payload).toHaveProperty("orderExpiryHours", 48);
  });

  it("should throw QabStorePurchaseConfigError when the delta itself is contradictory: delivery on + flat rate + no amount, all three in the SAME delta", () => {
    expect(() =>
      buildQabStorePayload(
        input({
          purchaseConfigChanges: {
            deliveryEnabled: true,
            deliveryFeeMode: "FLAT_RATE",
            deliveryFee: null,
          },
        })
      )
    ).toThrow(QabStorePurchaseConfigError);
  });

  it("should NOT throw for the same partial delta that only sets deliveryFee: null — the contradiction is only visible against the row QAB already has, not against this delta alone", () => {
    expect(() =>
      buildQabStorePayload(input({ purchaseConfigChanges: { deliveryFee: null } }))
    ).not.toThrow();
  });

  it("should still produce a payload that satisfies qabStorePayloadSchema when a delta is present", () => {
    const payload = buildQabStorePayload(
      input({ purchaseConfigChanges: { deliveryEnabled: true } })
    );
    expect(qabStorePayloadSchema.safeParse(payload).success).toBe(true);
  });
});
