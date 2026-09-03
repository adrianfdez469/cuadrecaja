import { describe, it, expect } from "vitest";
import { negocioAdminViewSchema } from "@/schemas/negocio";

/**
 * F-018 — the whitelist that GET/PUT /api/negocio respond with (ADR 0019).
 *
 * `negocioAdminViewSchema` is `.strict()` on purpose: it turns acceptance criterion 2
 * ("GET /api/negocio autenticado como SUPER_ADMIN devuelve solo los campos de un select
 * explícito: añadir una columna a Negocio y comprobar que NO aparece sola en la respuesta")
 * into a one-line test. Simulating "a column got added to Negocio" is exactly parsing a raw
 * object that carries one extra key the eleven-field whitelist doesn't know about.
 */

const validRow = {
  id: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
  nombre: "Cafetería Central",
  descripcion: "Negocio de prueba",
  createdAt: "2026-01-01T00:00:00.000Z",
  limitTime: "2027-01-01T00:00:00.000Z",
  planId: "3f8b2a5c-1234-4a1b-9c1d-abcdef123456",
  suspended: false,
  suspendedAt: null,
  creadoPorActivacionLanding: true,
  monedaBase: "CUP",
  monedaFuerte: "USD",
};

describe("negocioAdminViewSchema", () => {
  it("should accept a row with exactly the eleven whitelisted fields", () => {
    const parsed = negocioAdminViewSchema.parse(validRow);
    expect(parsed.id).toBe(validRow.id);
    expect(parsed.nombre).toBe(validRow.nombre);
    expect(parsed.monedaBase).toBe("CUP");
    expect(parsed.monedaFuerte).toBe("USD");
  });

  it("should coerce ISO date strings into Date instances (createdAt, limitTime)", () => {
    const parsed = negocioAdminViewSchema.parse(validRow);
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.limitTime).toBeInstanceOf(Date);
    expect(parsed.createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("should accept null for descripcion, planId and suspendedAt", () => {
    const parsed = negocioAdminViewSchema.parse({
      ...validRow,
      descripcion: null,
      planId: null,
      suspendedAt: null,
    });
    expect(parsed.descripcion).toBeNull();
    expect(parsed.planId).toBeNull();
    expect(parsed.suspendedAt).toBeNull();
  });

  it("should coerce suspendedAt when it is a date instead of null", () => {
    const parsed = negocioAdminViewSchema.parse({
      ...validRow,
      suspended: true,
      suspendedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(parsed.suspended).toBe(true);
    expect(parsed.suspendedAt).toBeInstanceOf(Date);
  });

  it("REGRESSION criterion 2 — should reject a row that carries a column the whitelist doesn't know about", () => {
    // Simulates "a new column was added to Negocio": qabToken (the very secret this feature is
    // a precondition for, per the spec) must not slip through by riding along on a valid row.
    const rowWithNewColumn = { ...validRow, qabToken: "qab_live_super_secret_token" };
    expect(() => negocioAdminViewSchema.parse(rowWithNewColumn)).toThrow();
  });

  it("REGRESSION criterion 2 — should reject any extra key, not just qabToken specifically", () => {
    const rowWithNewColumn = { ...validRow, unaColumnaNuevaCualquiera: "x" };
    const result = negocioAdminViewSchema.safeParse(rowWithNewColumn);
    expect(result.success).toBe(false);
  });

  it("should not let the secret's value leak into the ZodError even though the row is rejected", () => {
    // `result.data` is `undefined` on a failed safeParse — there is nothing to inspect there.
    // What can actually leak the secret is `result.error`: Zod's "unrecognized_keys" issue only
    // ever reports the KEY NAME ("qabToken"), never its value, but that guarantee lives in Zod's
    // own code, not in this schema. What this schema COULD get wrong is a future custom
    // `.superRefine`, or a hand-rolled strict-mode message, that embeds the raw row (and the
    // secret riding along with it) into the error text — which later gets logged. This pins that
    // the error artifact this module actually produces never contains the secret's value, while
    // still naming the offending key.
    const rowWithNewColumn = { ...validRow, qabToken: "qab_live_super_secret_token" };
    const result = negocioAdminViewSchema.safeParse(rowWithNewColumn);
    expect(result.success).toBe(false);
    if (!result.success) {
      const serializedError = JSON.stringify(result.error);
      expect(serializedError).not.toContain("qab_live_super_secret_token");
      expect(serializedError).toContain("qabToken");
    }
  });

  const requiredKeys = [
    "id",
    "nombre",
    "createdAt",
    "limitTime",
    "suspended",
    "creadoPorActivacionLanding",
    "monedaBase",
    "monedaFuerte",
  ] as const;

  it.each(requiredKeys)("should reject a row missing %s", (key) => {
    const incomplete: Record<string, unknown> = { ...validRow };
    delete incomplete[key];
    expect(() => negocioAdminViewSchema.parse(incomplete)).toThrow();
  });

  it("should reject a non-uuid id", () => {
    expect(() => negocioAdminViewSchema.parse({ ...validRow, id: "not-a-uuid" })).toThrow();
  });

  it("should reject a non-uuid planId that is not null", () => {
    expect(() =>
      negocioAdminViewSchema.parse({ ...validRow, planId: "not-a-uuid" }),
    ).toThrow();
  });

  it("should reject suspended as a non-boolean", () => {
    expect(() => negocioAdminViewSchema.parse({ ...validRow, suspended: "false" })).toThrow();
  });
});
