import { describe, it, expect } from "vitest";
import { buildQabCategoryPayload } from "@/lib/qab/qabCategoryPayload";
import { qabCategoryPayloadSchema } from "@/schemas/qabCategory";
import type { IQabCategoryPayloadInput } from "@/schemas/qabCategory";

/**
 * F-006 — `buildQabCategoryPayload` (`src/lib/qab/qabCategoryPayload.ts`,
 * contract §4.2, ADR 0045). Acceptance criterion 9: omitting `color` on the wire
 * DELETES the column on the other side, so a BLANK local value must become an
 * EXPLICIT `null`, never an absent key and never the blank string itself.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const CATEGORIA_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const OCCURRED_AT = new Date("2026-09-04T10:00:00.000Z");

function input(overrides: Partial<IQabCategoryPayloadInput> = {}): IQabCategoryPayloadInput {
  return {
    negocioId: NEGOCIO_ID,
    categoriaId: CATEGORIA_ID,
    nombre: "Bebidas",
    color: "#1E88E5",
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}

describe("buildQabCategoryPayload — criterion 9: the color bridge", () => {
  it("should carry a real colour through unchanged", () => {
    expect(buildQabCategoryPayload(input({ color: "#1E88E5" })).color).toBe("#1E88E5");
  });

  it("criterion 9's exact verification input: color '' (empty string) becomes color: null in the payload", () => {
    const payload = buildQabCategoryPayload(input({ color: "" }));
    expect(payload.color).toBeNull();
    expect("color" in payload).toBe(true); // key is ALWAYS present, never omitted
  });

  it("should map null to null", () => {
    expect(buildQabCategoryPayload(input({ color: null })).color).toBeNull();
  });

  it("should ALWAYS include the color key, even when it is null — omitting it would delete the column just the same", () => {
    const payload = buildQabCategoryPayload(input({ color: null }));
    expect("color" in payload).toBe(true);
    expect(JSON.stringify(payload)).toContain('"color":null');
  });
});

describe("buildQabCategoryPayload — field mapping", () => {
  it("should map categoriaId/negocioId/nombre to categoryId/businessId/name", () => {
    const payload = buildQabCategoryPayload(input());
    expect(payload.categoryId).toBe(CATEGORIA_ID);
    expect(payload.businessId).toBe(NEGOCIO_ID);
    expect(payload.name).toBe("Bebidas");
  });

  it("businessId should come from negocioId — the CARRIER, so a cascade caller can pass a different one per loop iteration", () => {
    const otherNegocio = "b4f2b2b2-2222-4222-8222-222222222222";
    const payload = buildQabCategoryPayload(input({ negocioId: otherNegocio }));
    expect(payload.businessId).toBe(otherNegocio);
  });

  it("should serialise updatedAt as occurredAt.toISOString()", () => {
    const payload = buildQabCategoryPayload(
      input({ occurredAt: new Date("2026-09-04T10:00:00.456Z") })
    );
    expect(payload.updatedAt).toBe("2026-09-04T10:00:00.456Z");
  });

  it("should NOT produce a slug key — the other side derives and freezes it at creation", () => {
    const payload = buildQabCategoryPayload(input());
    expect(payload).not.toHaveProperty("slug");
  });

  it("should throw for an empty name (a row that cannot produce a valid payload)", () => {
    expect(() => buildQabCategoryPayload(input({ nombre: "" }))).toThrow();
  });

  it("should produce a payload that itself satisfies qabCategoryPayloadSchema (.strict())", () => {
    const payload = buildQabCategoryPayload(input());
    expect(qabCategoryPayloadSchema.safeParse(payload).success).toBe(true);
  });
});
