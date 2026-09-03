import { describe, it, expect } from "vitest";
import {
  negocioQabSettingsSchema,
  negocioQabSettingsItemSchema,
  negociosQabSettingsListSchema,
  negocioTiendaOnlineToggleSchema,
  qabTokenPasteSchema,
} from "@/schemas/qabNegocio";
import { QAB_TOKEN_MIN_LENGTH, QAB_TOKEN_MAX_LENGTH } from "@/constants/qabProvisioning";

/**
 * F-001 / F-003 — the QAB block of a Negocio, as it may be shown, and the two request bodies
 * that mutate it.
 *
 * The token is NOT in `negocioQabSettingsSchema` and never will be: what is exposed is
 * `qabTokenConfigurado`, derived server-side from `qabToken !== null`. Since F-003 (ADR 0025)
 * this schema is `.strict()`: a stray `qabToken` on the object being parsed no longer gets
 * silently dropped, it makes `parse` throw. That is a deliberate change from F-001's original
 * behaviour (see the two "REGRESSION F-001 -> F-003" cases below) — a louder failure for a
 * programming mistake that was previously invisible.
 *
 * `.strict()` alone does NOT satisfy acceptance criterion 16 ("un test cubre que
 * negocioQabSettingsSchema no admite ningún campo derivado del token más allá del booleano y
 * la fecha: añadir uno hace fallar el test") — see ADR 0025. `.strict()` only rejects extra
 * keys on the INPUT being parsed; it says nothing about the schema itself growing a new field.
 * What satisfies criterion 16 is the `Object.keys(schema.shape)` assertion below, compared
 * against a list typed BY HAND, deliberately NOT imported from any shared constant: if the
 * comparison list were imported, adding a field to the schema and to that same constant in one
 * commit would leave this test green, which is exactly what the criterion exists to prevent.
 */

const baseSettings = {
  tiendaOnlineHabilitada: true,
  qabTokenConfigurado: true,
  qabTokenActualizadoAt: new Date("2026-09-01T10:00:00.000Z"),
};

const baseSettingsItem = {
  ...baseSettings,
  negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
};

describe("negocioQabSettingsSchema", () => {
  it("should accept a business with the online store enabled and a token configured", () => {
    const parsed = negocioQabSettingsSchema.parse(baseSettings);

    expect(parsed).toEqual(baseSettings);
  });

  it("should accept a business that never configured a token", () => {
    const parsed = negocioQabSettingsSchema.parse({
      tiendaOnlineHabilitada: false,
      qabTokenConfigurado: false,
      qabTokenActualizadoAt: null,
    });

    expect(parsed.qabTokenConfigurado).toBe(false);
    expect(parsed.qabTokenActualizadoAt).toBeNull();
  });

  it("REGRESSION F-001 -> F-003 (ADR 0025) — should REJECT a qabToken key, not silently drop it", () => {
    // Until F-003 this used to parse successfully and discard the key. .strict() (ADR 0025)
    // turns that silent discard into a loud failure: a caller that accidentally spreads a raw
    // Prisma row into this schema now gets an exception instead of a response that happens to
    // be safe by luck.
    const result = negocioQabSettingsSchema.safeParse({
      ...baseSettings,
      qabToken: "qab_live_super_secret_token",
    });

    expect(result.success).toBe(false);
  });

  it("REGRESSION F-001 -> F-003 (ADR 0025) — parse() should throw, not strip, when qabToken rides along", () => {
    expect(() =>
      negocioQabSettingsSchema.parse({ ...baseSettings, qabToken: "qab_live_super_secret_token" })
    ).toThrow();
  });

  it("should not leak the secret's value into the ZodError when a stray qabToken is rejected", () => {
    const result = negocioQabSettingsSchema.safeParse({
      ...baseSettings,
      qabToken: "qab_live_super_secret_token",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const serializedError = JSON.stringify(result.error);
      expect(serializedError).not.toContain("qab_live_super_secret_token");
    }
  });

  it("should expose whether a token is configured, never the token itself", () => {
    const parsed = negocioQabSettingsSchema.parse(baseSettings);

    expect(typeof parsed.qabTokenConfigurado).toBe("boolean");
    expect(Object.keys(parsed)).not.toContain("qabToken");
  });

  it("CRITERION 16 — should admit exactly these three keys, and no more", () => {
    // Hand-written on purpose (ADR 0025): NOT imported from any exported constant. If this
    // list were derived from the same source the schema is, adding a field to both in the same
    // commit would leave this assertion green, defeating the whole point of the criterion.
    expect(Object.keys(negocioQabSettingsSchema.shape).sort()).toEqual(
      ["qabTokenActualizadoAt", "qabTokenConfigurado", "tiendaOnlineHabilitada"].sort()
    );
  });

  const invalidSettings: Array<[string, Record<string, unknown>]> = [
    ["tiendaOnlineHabilitada is missing", { ...baseSettings, tiendaOnlineHabilitada: undefined }],
    ["qabTokenConfigurado is missing", { ...baseSettings, qabTokenConfigurado: undefined }],
    [
      "qabTokenActualizadoAt is missing",
      { ...baseSettings, qabTokenActualizadoAt: undefined },
    ],
    [
      "qabTokenConfigurado is a string instead of a boolean",
      { ...baseSettings, qabTokenConfigurado: "true" },
    ],
    [
      "qabTokenActualizadoAt is an ISO string instead of a Date",
      { ...baseSettings, qabTokenActualizadoAt: "2026-09-01T10:00:00.000Z" },
    ],
  ];

  it.each(invalidSettings)("should reject a block where %s", (_label, value) => {
    expect(negocioQabSettingsSchema.safeParse(value).success).toBe(false);
  });
});

describe("negocioQabSettingsItemSchema", () => {
  it("should accept the base block plus a uuid negocioId", () => {
    const parsed = negocioQabSettingsItemSchema.parse(baseSettingsItem);
    expect(parsed).toEqual(baseSettingsItem);
  });

  it("should coerce an ISO date string for qabTokenActualizadoAt (it travels over HTTP as a string)", () => {
    const parsed = negocioQabSettingsItemSchema.parse({
      ...baseSettingsItem,
      qabTokenActualizadoAt: "2026-09-01T10:00:00.000Z",
    });
    expect(parsed.qabTokenActualizadoAt).toBeInstanceOf(Date);
  });

  it("should reject a non-uuid negocioId", () => {
    expect(
      negocioQabSettingsItemSchema.safeParse({ ...baseSettingsItem, negocioId: "not-a-uuid" }).success
    ).toBe(false);
  });

  it("should reject a stray qabToken key (it extends the .strict() base with .extend().strict())", () => {
    expect(
      negocioQabSettingsItemSchema.safeParse({ ...baseSettingsItem, qabToken: "secret" }).success
    ).toBe(false);
  });

  it("CRITERION 16 — should admit exactly the base three keys plus negocioId, and no more", () => {
    // Same hand-written-list rule as above, extended with the one extra field this schema adds.
    expect(Object.keys(negocioQabSettingsItemSchema.shape).sort()).toEqual(
      ["negocioId", "qabTokenActualizadoAt", "qabTokenConfigurado", "tiendaOnlineHabilitada"].sort()
    );
  });
});

describe("negociosQabSettingsListSchema", () => {
  const validList = {
    autoProvisioningAvailable: true,
    autoProvisioningUnavailableReason: null,
    negocios: [baseSettingsItem],
  };

  it("should accept a well formed list with auto-provisioning available", () => {
    expect(negociosQabSettingsListSchema.parse(validList)).toEqual(validList);
  });

  it.each(["SECRET_NOT_SET", "SECRET_INVALID", "BASE_URL_NOT_SET", "BASE_URL_INVALID"])(
    "should accept autoProvisioningUnavailableReason: %s when unavailable",
    (reason) => {
      expect(
        negociosQabSettingsListSchema.safeParse({
          autoProvisioningAvailable: false,
          autoProvisioningUnavailableReason: reason,
          negocios: [],
        }).success
      ).toBe(true);
    }
  );

  it("should reject an unavailable reason outside the four-value enum", () => {
    expect(
      negociosQabSettingsListSchema.safeParse({
        autoProvisioningAvailable: false,
        autoProvisioningUnavailableReason: "SOMETHING_ELSE",
        negocios: [],
      }).success
    ).toBe(false);
  });

  it("should accept an empty negocios array", () => {
    expect(
      negociosQabSettingsListSchema.safeParse({
        autoProvisioningAvailable: true,
        autoProvisioningUnavailableReason: null,
        negocios: [],
      }).success
    ).toBe(true);
  });

  it("should reject a business in the list that carries a qabToken", () => {
    expect(
      negociosQabSettingsListSchema.safeParse({
        ...validList,
        negocios: [{ ...baseSettingsItem, qabToken: "secret" }],
      }).success
    ).toBe(false);
  });

  it("should be strict at the top level", () => {
    expect(negociosQabSettingsListSchema.safeParse({ ...validList, extra: "x" }).success).toBe(false);
  });
});

describe("negocioTiendaOnlineToggleSchema", () => {
  it("should accept { tiendaOnlineHabilitada: true }", () => {
    expect(negocioTiendaOnlineToggleSchema.parse({ tiendaOnlineHabilitada: true })).toEqual({
      tiendaOnlineHabilitada: true,
    });
  });

  it("should accept { tiendaOnlineHabilitada: false }", () => {
    expect(negocioTiendaOnlineToggleSchema.safeParse({ tiendaOnlineHabilitada: false }).success).toBe(
      true
    );
  });

  it("should reject a non-boolean value", () => {
    expect(negocioTiendaOnlineToggleSchema.safeParse({ tiendaOnlineHabilitada: "true" }).success).toBe(
      false
    );
  });

  it("should reject an empty body", () => {
    expect(negocioTiendaOnlineToggleSchema.safeParse({}).success).toBe(false);
  });

  it("should be strict: reject an extra key", () => {
    expect(
      negocioTiendaOnlineToggleSchema.safeParse({ tiendaOnlineHabilitada: true, extra: "x" }).success
    ).toBe(false);
  });
});

describe("qabTokenPasteSchema — the manual-paste rescue path (criterion 13)", () => {
  // Printable ASCII, no whitespace, exactly at the contract's boundaries.
  const validToken = "b".repeat(QAB_TOKEN_MIN_LENGTH);

  it("should accept a well formed token and trim surrounding whitespace", () => {
    const parsed = qabTokenPasteSchema.parse({ token: `  ${validToken}  ` });
    expect(parsed.token).toBe(validToken);
  });

  it(`should accept a token of exactly ${QAB_TOKEN_MIN_LENGTH} characters (inclusive lower boundary)`, () => {
    expect(qabTokenPasteSchema.safeParse({ token: "c".repeat(QAB_TOKEN_MIN_LENGTH) }).success).toBe(
      true
    );
  });

  it(`should reject a token of ${QAB_TOKEN_MIN_LENGTH - 1} characters`, () => {
    expect(
      qabTokenPasteSchema.safeParse({ token: "c".repeat(QAB_TOKEN_MIN_LENGTH - 1) }).success
    ).toBe(false);
  });

  it(`should accept a token of exactly ${QAB_TOKEN_MAX_LENGTH} characters (inclusive upper boundary)`, () => {
    expect(qabTokenPasteSchema.safeParse({ token: "c".repeat(QAB_TOKEN_MAX_LENGTH) }).success).toBe(
      true
    );
  });

  it(`should reject a token of ${QAB_TOKEN_MAX_LENGTH + 1} characters`, () => {
    expect(
      qabTokenPasteSchema.safeParse({ token: "c".repeat(QAB_TOKEN_MAX_LENGTH + 1) }).success
    ).toBe(false);
  });

  // Header-injection regression (ADR 0026, point 4): this value ends up concatenated into
  // `Authorization: Bearer ${token}`. Each case keeps the length within bounds so a failure
  // can only be attributed to the character, never to length.
  it("should reject a token with an internal newline", () => {
    const injected = "c".repeat(20) + "\n" + "c".repeat(QAB_TOKEN_MIN_LENGTH - 20);
    expect(qabTokenPasteSchema.safeParse({ token: injected }).success).toBe(false);
  });

  it("should reject a token with an internal carriage return", () => {
    const injected = "c".repeat(20) + "\r" + "c".repeat(QAB_TOKEN_MIN_LENGTH - 20);
    expect(qabTokenPasteSchema.safeParse({ token: injected }).success).toBe(false);
  });

  it("should reject a token with an internal space", () => {
    const injected = "c".repeat(20) + " " + "c".repeat(QAB_TOKEN_MIN_LENGTH - 20);
    expect(qabTokenPasteSchema.safeParse({ token: injected }).success).toBe(false);
  });

  it("should reject a token with a tab character", () => {
    const injected = "c".repeat(20) + "\t" + "c".repeat(QAB_TOKEN_MIN_LENGTH - 20);
    expect(qabTokenPasteSchema.safeParse({ token: injected }).success).toBe(false);
  });

  it("should reject a non-ASCII character", () => {
    const injected = "c".repeat(20) + "é" + "c".repeat(QAB_TOKEN_MIN_LENGTH - 20);
    expect(qabTokenPasteSchema.safeParse({ token: injected }).success).toBe(false);
  });

  it("should reject a blank token (whitespace only)", () => {
    expect(qabTokenPasteSchema.safeParse({ token: "   " }).success).toBe(false);
  });

  it("should reject a missing token", () => {
    expect(qabTokenPasteSchema.safeParse({}).success).toBe(false);
  });

  it("should be strict: reject an extra key", () => {
    expect(qabTokenPasteSchema.safeParse({ token: validToken, extra: "x" }).success).toBe(false);
  });
});
