import { describe, it, expect } from "vitest";
import { qabSlugSchema, openingHoursSchema, tiendaOnlineSchema } from "@/schemas/qabStore";
import { QAB_UNPUBLISH_REASON_MAX_LENGTH } from "@/constants/qab";

/**
 * F-001 — the online-store block of a Tienda.
 *
 * Two contract constraints carry real weight here:
 *
 *  - `motivoDespublicacion` (unpublishReason) is plain text of at most 160 characters, and it
 *    wears a double guard: @db.VarChar(160) in the database and .max(160) in Zod. This file
 *    verifies the Zod half; the database half is qa's, in SQL.
 *  - `horarios` (openingHours) is OPAQUE ON PURPOSE. The contract declares it Json? and does not
 *    publish its shape; F-005 fixes it once QAB does. So the schema must accept anything, and
 *    these tests must NOT pin down a shape — pinning one here would invent a format that looks
 *    agreed upon and that QAB does not understand.
 */

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
  horarios: { mon: ["09:00", "17:00"] },
  motivoDespublicacion: "Cerrado por inventario",
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

describe("openingHoursSchema", () => {
  // Opaque by contract: F-001 creates the column and NOTHING writes to it. The only thing that
  // can be asserted today is that no shape is imposed.
  const anyShapes: Array<[string, unknown]> = [
    ["an object", { mon: ["09:00", "17:00"] }],
    ["an array", [{ day: 1, open: "09:00" }]],
    ["a string", "09:00-17:00"],
    ["a number", 9],
    ["null", null],
  ];

  it.each(anyShapes)("should accept %s without imposing a shape", (_label, value) => {
    expect(openingHoursSchema.safeParse(value).success).toBe(true);
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

  it("should not carry an unknown key through", () => {
    const parsed = tiendaOnlineSchema.parse({
      ...baseTiendaOnline,
      existencia: 40,
    });

    // The forbidden list of the contract: `existencia` must never travel to QAB.
    expect(parsed).not.toHaveProperty("existencia");
  });
});
