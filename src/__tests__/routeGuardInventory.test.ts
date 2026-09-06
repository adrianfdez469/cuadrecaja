import { describe, it, expect } from "vitest";

/**
 * F-021 — the route inventory (contract § 3, ADR 0079) and its ratchet (ADR 0081).
 *
 * Three separate concerns, deliberately kept in one file because they are one artifact:
 *
 *   1. `extractRouteVerbs` against hand-written fake sources, BEFORE trusting it on the
 *      real tree (ADR 0079: "el extractor no se cree bajo palabra").
 *   2. The census: the (route, verb) pairs the JSON declares must be EXACTLY the pairs
 *      `listRouteHandlerVerbs()` finds on disk — neither missing nor extra. This is what
 *      makes a new, unclassified `route.ts` break the suite (the "abierta por omisión"
 *      fix ADR 0079 exists for).
 *   3. The schema's seven invariants (§ 3), and the `DESPROTEGIDAS_ABIERTAS` ratchet
 *      (ADR 0081): it must equal the JSON's own count of `desprotegida` entries (so it
 *      cannot be hand-edited down without actually closing routes), AND it must reach
 *      zero (the feature is not done otherwise).
 */

import {
  extractRouteVerbs,
  listRouteHandlerVerbs,
  readRouteGuardInventory,
  correctedByF021,
  stillUnprotected,
} from "@/lib/routeGuards/routeInventory";

import {
  routeGuardEntrySchema,
  routeGuardInventorySchema,
  type IRouteGuardEntry,
} from "@/schemas/routeGuards";

import { DESPROTEGIDAS_ABIERTAS } from "@/constants/tenantScope";

describe("extractRouteVerbs — against hand-written fake sources (ADR 0079)", () => {
  it("finds both verbs when a file exports GET and POST as async functions", () => {
    const source = `
      export async function GET(req: Request) { return new Response(); }
      export async function POST(req: Request) { return new Response(); }
    `;
    expect([...extractRouteVerbs(source)].sort()).toEqual(["GET", "POST"]);
  });

  it("finds a verb declared as a const arrow function", () => {
    const source = `export const GET = async (req: Request) => new Response();`;
    expect(extractRouteVerbs(source)).toEqual(["GET"]);
  });

  it("finds a verb declared as a plain (non-async) function export", () => {
    const source = `export function OPTIONS(req: Request) { return new Response(null); }`;
    expect(extractRouteVerbs(source)).toEqual(["OPTIONS"]);
  });

  it("finds both verbs re-exported through `export { handler as GET, handler as POST }` — the auth/[...nextauth] form", () => {
    // ADR 0079: a 3-form extractor counts 227 verbs where there are 229, because it
    // misses exactly this file's declaration style.
    const source = `
      const handler = NextAuth(authOptions);
      export { handler as GET, handler as POST };
    `;
    expect([...extractRouteVerbs(source)].sort()).toEqual(["GET", "POST"]);
  });

  it("does NOT count a verb that only appears inside a comment or a string literal", () => {
    const source = `
      // export async function GET(req: Request) {}
      const example = "export async function GET(req) {}";
      export async function POST(req: Request) { return new Response(); }
    `;
    expect(extractRouteVerbs(source)).toEqual(["POST"]);
  });

  it("returns an empty array for a file that declares no route verb at all", () => {
    const source = `export const runtime = "nodejs";`;
    expect(extractRouteVerbs(source)).toEqual([]);
  });
});

describe("the route inventory census — ADR 0079's whole point", () => {
  it("matches, pair by pair (route, verb), what the disk actually exports — neither missing nor extra", () => {
    const onDisk = new Set(
      listRouteHandlerVerbs().flatMap(({ route, verbs }) =>
        verbs.map((verb) => `${route}::${verb}`),
      ),
    );
    const inventory = readRouteGuardInventory();
    const inInventory = new Set(inventory.map((e) => `${e.route}::${e.verb}`));

    const missingFromInventory = [...onDisk].filter((pair) => !inInventory.has(pair));
    const extraInInventory = [...inInventory].filter((pair) => !onDisk.has(pair));

    // A route.ts added without a matching JSON entry breaks here — that IS the point.
    expect({ missingFromInventory, extraInInventory }).toEqual({
      missingFromInventory: [],
      extraInInventory: [],
    });
  });

  it("recognizes the export-reexport form of auth/[...nextauth]/route.ts on the real tree, not just the fake source", () => {
    const entry = listRouteHandlerVerbs().find(
      (e) => e.route === "auth/[...nextauth]/route.ts",
    );
    expect(entry?.verbs.slice().sort()).toEqual(["GET", "POST"]);
  });

  it("every inventory entry has a non-empty, one-line motivo — criteria 1 and 4", () => {
    const inventory = readRouteGuardInventory();
    const withoutMotivo = inventory.filter((e) => e.motivo.trim().length === 0);
    expect(withoutMotivo).toEqual([]);
  });

  it("every 'publica' entry declares devuelveDatosDeNegocio: false — criterion 4", () => {
    const inventory = readRouteGuardInventory();
    const publicasQueDevuelvenDatos = inventory.filter(
      (e) => e.clasificacion === "publica" && e.devuelveDatosDeNegocio !== false,
    );
    expect(publicasQueDevuelvenDatos).toEqual([]);
  });

  it("every 'protegida' entry names its helper and its kind — criterion 8", () => {
    const inventory = readRouteGuardInventory();
    const sinHelperOKind = inventory.filter(
      (e) => e.clasificacion === "protegida" && (e.helper === null || e.kind === null),
    );
    expect(sinHelperOKind).toEqual([]);
  });

  it("every 'protegida' entry of kind 'tenant' names its tenantModel and tenantParam — criterion 8", () => {
    const inventory = readRouteGuardInventory();
    const tenantSinModeloOParam = inventory.filter(
      (e) =>
        e.clasificacion === "protegida" &&
        e.kind === "tenant" &&
        (e.tenantModel === null || e.tenantParam === null),
    );
    expect(tenantSinModeloOParam).toEqual([]);
  });
});

describe("routeGuardEntrySchema invariants (contract § 3)", () => {
  function validEntry(overrides: Partial<IRouteGuardEntry> = {}): unknown {
    return {
      route: "example/route.ts",
      verb: "GET",
      clasificacion: "protegida",
      kind: "tenant",
      motivo: "example reason",
      helper: "assertTiendaTenant",
      tenantModel: "tienda",
      tenantParam: "path:tiendaId",
      permiso: "configuracion.locales.acceder",
      permisoAusenteMotivo: null,
      devuelveDatosDeNegocio: false,
      corregidaPor: null,
      ...overrides,
    };
  }

  it("accepts a fully valid 'protegida'/'tenant' entry", () => {
    expect(routeGuardEntrySchema.safeParse(validEntry()).success).toBe(true);
  });

  it("accepts a fully valid 'publica' entry", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({
          clasificacion: "publica",
          kind: null,
          helper: null,
          tenantModel: null,
          tenantParam: null,
          permiso: null,
          permisoAusenteMotivo: "no-aplica",
          devuelveDatosDeNegocio: false,
        }),
      ).success,
    ).toBe(true);
  });

  it("invariant 1: 'protegida' requires a non-null kind", () => {
    expect(routeGuardEntrySchema.safeParse(validEntry({ kind: null })).success).toBe(
      false,
    );
  });

  it("invariant 1: 'protegida' requires a non-null helper", () => {
    expect(routeGuardEntrySchema.safeParse(validEntry({ helper: null })).success).toBe(
      false,
    );
  });

  it("invariant 2: kind 'tenant' requires a non-null tenantModel", () => {
    expect(
      routeGuardEntrySchema.safeParse(validEntry({ tenantModel: null })).success,
    ).toBe(false);
  });

  it("invariant 2: kind 'tenant' requires a non-null tenantParam", () => {
    expect(
      routeGuardEntrySchema.safeParse(validEntry({ tenantParam: null })).success,
    ).toBe(false);
  });

  it("invariant 3: kind other than 'tenant' forbids a non-null tenantModel", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({
          kind: "sin-fila",
          tenantParam: null,
          permiso: null,
          permisoAusenteMotivo: "no-aplica",
          // tenantModel left non-null on purpose: this is exactly what invariant 3 forbids
        }),
      ).success,
    ).toBe(false);
  });

  it("invariant 4: permiso null requires a permisoAusenteMotivo", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({ permiso: null, permisoAusenteMotivo: null }),
      ).success,
    ).toBe(false);
  });

  it("invariant 4: a non-null permiso forbids a permisoAusenteMotivo", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({ permiso: "algo", permisoAusenteMotivo: "justificado" }),
      ).success,
    ).toBe(false);
  });

  it("invariant 5: 'publica' forbids devuelveDatosDeNegocio: true — criterion 4", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({
          clasificacion: "publica",
          kind: null,
          helper: null,
          tenantModel: null,
          tenantParam: null,
          permiso: null,
          permisoAusenteMotivo: "no-aplica",
          devuelveDatosDeNegocio: true,
        }),
      ).success,
    ).toBe(false);
  });

  it("invariant 6: 'desprotegida' forbids a non-null corregidaPor", () => {
    expect(
      routeGuardEntrySchema.safeParse(
        validEntry({
          clasificacion: "desprotegida",
          kind: null,
          helper: null,
          tenantModel: null,
          tenantParam: null,
          permiso: null,
          permisoAusenteMotivo: "deuda-f021",
          corregidaPor: "F-021",
        }),
      ).success,
    ).toBe(false);
  });

  it("motivo can never be empty, in any category", () => {
    expect(routeGuardEntrySchema.safeParse(validEntry({ motivo: "" })).success).toBe(
      false,
    );
  });

  it("invariant 7: the (route, verb) pair is unique across the whole array", () => {
    const duplicated = [validEntry(), validEntry()];
    expect(routeGuardInventorySchema.safeParse(duplicated).success).toBe(false);
  });

  it("invariant 7: the same route with a DIFFERENT verb is not a duplicate", () => {
    const distinctVerbs = [validEntry(), validEntry({ verb: "POST" })];
    expect(routeGuardInventorySchema.safeParse(distinctVerbs).success).toBe(true);
  });
});

describe("the ratchet: DESPROTEGIDAS_ABIERTAS (ADR 0081)", () => {
  it("cannot be gamed by hand-editing the constant alone: it must equal the JSON's own count of 'desprotegida' entries", () => {
    // If someone lowers DESPROTEGIDAS_ABIERTAS without reclassifying the corresponding
    // JSON entries, this comparison — driven by the JSON via `stillUnprotected`, not by
    // the constant itself — breaks. That is the anti-cheat property the ratchet needs.
    const inventory = readRouteGuardInventory();
    expect(stillUnprotected(inventory).length).toBe(DESPROTEGIDAS_ABIERTAS);
  });

  it("is the feature's actual gate: DESPROTEGIDAS_ABIERTAS must be zero before F-021 can be marked passes:true", () => {
    expect(DESPROTEGIDAS_ABIERTAS).toBe(0);
  });
});

describe("correctedByF021", () => {
  it("returns only entries this feature corrected, and there are at least 37 of them", () => {
    const inventory = readRouteGuardInventory();
    const corrected = correctedByF021(inventory);
    expect(corrected.length).toBeGreaterThanOrEqual(37);
    expect(corrected.every((e) => e.corregidaPor === "F-021")).toBe(true);
  });
});
