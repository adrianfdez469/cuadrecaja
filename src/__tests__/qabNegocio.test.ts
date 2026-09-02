import { describe, it, expect } from "vitest";
import { negocioQabSettingsSchema } from "@/schemas/qabNegocio";

/**
 * F-001 — the QAB block of a Negocio, as it may be shown.
 *
 * The token is NOT in this schema and never will be: what is exposed is `qabTokenConfigurado`,
 * derived server-side from `qabToken !== null`. The test below is the unit-level version of
 * acceptance criterion 6 ("Negocio.qabToken does not appear in any API response"): even when the
 * object being parsed carries the secret, the parsed result must not.
 *
 * The other half of criterion 6 — the global `omit` of the Prisma client and a real call to the
 * negocio endpoints — is qa's, executed, not read.
 */

const baseSettings = {
  tiendaOnlineHabilitada: true,
  qabTokenConfigurado: true,
  qabTokenActualizadoAt: new Date("2026-09-01T10:00:00.000Z"),
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

  it("should NOT let the qabToken key through", () => {
    const parsed = negocioQabSettingsSchema.parse({
      ...baseSettings,
      qabToken: "qab_live_super_secret_token",
    });

    expect(parsed).not.toHaveProperty("qabToken");
    expect(Object.keys(parsed).sort()).toEqual(
      ["qabTokenActualizadoAt", "qabTokenConfigurado", "tiendaOnlineHabilitada"].sort()
    );
  });

  it("should NOT let the token value survive serialization", () => {
    const parsed = negocioQabSettingsSchema.parse({
      ...baseSettings,
      qabToken: "qab_live_super_secret_token",
    });

    expect(JSON.stringify(parsed)).not.toContain("qab_live_super_secret_token");
  });

  it("should expose whether a token is configured, never the token itself", () => {
    const parsed = negocioQabSettingsSchema.parse(baseSettings);

    expect(typeof parsed.qabTokenConfigurado).toBe("boolean");
    expect(Object.keys(parsed)).not.toContain("qabToken");
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
