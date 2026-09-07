import { describe, it, expect } from "vitest";
import {
  qabMirrorRowSchema,
  qabCatalogHashSchema,
  qabAlertDescriptorSchema,
} from "@/schemas/qabReconciliation";
import type { IQabMirrorRow } from "@/schemas/qabReconciliation";

/**
 * F-008 — `src/schemas/qabReconciliation.ts` (contract § 2), against
 * `.agents/specs/F-008.md`.
 *
 * `qabAlertDescriptorSchema.negociosDestino` carries the whole defense against
 * `security-guardian`'s C2 finding: `Notificacion.negociosDestino` empty means "every
 * business", not "none" (`prisma/schema.prisma`, confirmed in
 * `src/app/api/notificaciones/activas/route.ts`). The contract makes an empty string
 * NOT COMPILE by typing the field `z.string().min(1)` rather than
 * `z.string().optional()`; the runtime half of that same guarantee — an ACTUAL empty
 * string being rejected, not just an absent one — is what the test below exercises,
 * since `tsc --noEmit` alone cannot catch a value that type-checks but is empty at
 * runtime.
 */

function mirrorRow(overrides: Partial<IQabMirrorRow> = {}): IQabMirrorRow {
  return {
    id: "a",
    precio: 1990.0,
    monedaPrecioCode: "CUP",
    dispPublicada: "AVAILABLE",
    ...overrides,
  };
}

describe("qabMirrorRowSchema", () => {
  it("accepts a well formed row", () => {
    const row = mirrorRow();
    expect(qabMirrorRowSchema.parse(row)).toEqual(row);
  });

  it("accepts dispPublicada: null", () => {
    expect(qabMirrorRowSchema.safeParse(mirrorRow({ dispPublicada: null })).success).toBe(true);
  });

  it("rejects an empty id", () => {
    expect(qabMirrorRowSchema.safeParse(mirrorRow({ id: "" })).success).toBe(false);
  });

  it("rejects a non-finite precio", () => {
    expect(qabMirrorRowSchema.safeParse(mirrorRow({ precio: Number.NaN })).success).toBe(false);
    expect(qabMirrorRowSchema.safeParse(mirrorRow({ precio: Number.POSITIVE_INFINITY })).success).toBe(false);
  });

  it("rejects an empty monedaPrecioCode", () => {
    expect(qabMirrorRowSchema.safeParse(mirrorRow({ monedaPrecioCode: "" })).success).toBe(false);
  });
});

describe("qabCatalogHashSchema", () => {
  it("accepts the contract's own vector hash", () => {
    expect(
      qabCatalogHashSchema.safeParse({ products: 4, hash: "62e399684e3a8eafadaae58391537955" }).success
    ).toBe(true);
  });

  it("rejects an uppercase hash — the pattern is lowercase hex only", () => {
    expect(
      qabCatalogHashSchema.safeParse({ products: 4, hash: "62E399684E3A8EAFADAAE58391537955" }).success
    ).toBe(false);
  });

  it("rejects a hash of the wrong length", () => {
    expect(qabCatalogHashSchema.safeParse({ products: 0, hash: "abc" }).success).toBe(false);
  });

  it("rejects a negative products count", () => {
    expect(
      qabCatalogHashSchema.safeParse({ products: -1, hash: "d41d8cd98f00b204e9800998ecf8427e" }).success
    ).toBe(false);
  });
});

function alertDescriptor(overrides: Record<string, unknown> = {}) {
  return {
    titulo: "Tienda online: catálogo desincronizado",
    descripcion: "algo pasó",
    nivelImportancia: "ALTA",
    tipo: "ALERTA",
    negociosDestino: "negocio-1",
    usuariosDestino: "",
    accionUrl: "/tienda-online/configuracion",
    fechaInicio: new Date(),
    fechaFin: new Date(),
    ...overrides,
  };
}

describe("qabAlertDescriptorSchema", () => {
  it("accepts a well formed descriptor", () => {
    expect(qabAlertDescriptorSchema.safeParse(alertDescriptor()).success).toBe(true);
  });

  it("rejects negociosDestino: \"\" — empty means EVERY business on this model, never none (security-guardian C2)", () => {
    expect(qabAlertDescriptorSchema.safeParse(alertDescriptor({ negociosDestino: "" })).success).toBe(false);
  });

  it("rejects usuariosDestino carrying anything other than the empty string", () => {
    expect(qabAlertDescriptorSchema.safeParse(alertDescriptor({ usuariosDestino: "user-1" })).success).toBe(
      false
    );
  });
});
