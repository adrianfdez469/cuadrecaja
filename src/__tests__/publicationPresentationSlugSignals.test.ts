import { describe, it, expect } from "vitest";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { QAB_PUBLIC_STORE_URL_PREFIX } from "@/constants/qab";

/**
 * F-020 — the two new screen signals of `src/components/tiendaOnline/publicationPresentation.ts`
 * (contract §8, ADR 0038): `isStoreAddressCommitted`, `isKnownInOnlineStore`, `onlineStoreUrl`,
 * `assignedSlugNotice` and `publicStoreUrl`.
 *
 * `publicationPresentation.test.ts` already pins `publicationPresentation()` itself and is
 * declared untouchable by the contract (§16): this file is ADDITIVE, covering the new exports
 * of the SAME module without editing that file.
 *
 * ADR 0038's whole point is that these are TWO DIFFERENT QUESTIONS, and E-013 is exactly what
 * happens when they collapse into one. Every describe block below tests one signal alone, and
 * the last one asserts the four `firstPublishPending` x `slugQab` combinations do NOT collapse
 * — in particular state B (§9): published, address frozen, value still unknown.
 */

const {
  isStoreAddressCommitted,
  isKnownInOnlineStore,
  onlineStoreUrl,
  assignedSlugNotice,
  publicStoreUrl,
} = await import("@/components/tiendaOnline/publicationPresentation");

function baseLocal(overrides: Partial<ITiendaOnlineLocal> = {}): ITiendaOnlineLocal {
  return {
    id: "a3f1a1a1-1111-4111-8111-111111111111",
    nombre: "Sucursal Centro",
    tipo: "TIENDA",
    publicarEnTienda: true,
    slug: "la-rampa",
    slugQab: null,
    descripcion: null,
    direccion: null,
    ciudad: null,
    provincia: null,
    latitud: null,
    longitud: null,
    telefono: null,
    whatsapp: null,
    email: null,
    horarios: null,
    horariosInvalid: false,
    horariosIssues: [],
    motivoDespublicacion: null,
    publishable: true,
    firstPublishPending: true,
    syncState: { state: "SYNCED", code: null, attempts: 0, since: null },
    ...overrides,
  };
}

describe("publicStoreUrl", () => {
  it("should be QAB_PUBLIC_STORE_URL_PREFIX + the slug, literally", () => {
    expect(publicStoreUrl("la-rampa-2")).toBe(`${QAB_PUBLIC_STORE_URL_PREFIX}la-rampa-2`);
  });

  it("should always start with https:// — no other scheme can come out of this function", () => {
    expect(publicStoreUrl("anything")).toMatch(/^https:\/\//);
  });
});

describe("isStoreAddressCommitted — !firstPublishPending (ADR 0038a)", () => {
  it("should be false while the local has never published (firstPublishPending: true)", () => {
    expect(isStoreAddressCommitted(baseLocal({ firstPublishPending: true }))).toBe(false);
  });

  it("should be true once a STORE event of this local carried publishToStore: true, WITHOUT waiting for slugQab to be known", () => {
    // This is the new state B of §9: committed even though slugQab is still null.
    expect(
      isStoreAddressCommitted(baseLocal({ firstPublishPending: false, slugQab: null }))
    ).toBe(true);
  });

  it("should NOT depend on slugQab at all — same firstPublishPending, different slugQab, same result", () => {
    const withSlugQab = isStoreAddressCommitted(
      baseLocal({ firstPublishPending: false, slugQab: "la-rampa-2" })
    );
    const withoutSlugQab = isStoreAddressCommitted(
      baseLocal({ firstPublishPending: false, slugQab: null })
    );
    expect(withSlugQab).toBe(withoutSlugQab);
    expect(withSlugQab).toBe(true);
  });
});

describe("isKnownInOnlineStore — slugQab !== null (ADR 0038b)", () => {
  it("should be false when slugQab is null", () => {
    expect(isKnownInOnlineStore(baseLocal({ slugQab: null }))).toBe(false);
  });

  it("should be true when slugQab is populated", () => {
    expect(isKnownInOnlineStore(baseLocal({ slugQab: "la-rampa-2" }))).toBe(true);
  });

  it("should NOT depend on firstPublishPending at all — a FAILED/BLOCKED first publish must never claim knowledge it does not have", () => {
    const pendingTrue = isKnownInOnlineStore(baseLocal({ firstPublishPending: true, slugQab: null }));
    const pendingFalse = isKnownInOnlineStore(
      baseLocal({ firstPublishPending: false, slugQab: null })
    );
    expect(pendingTrue).toBe(pendingFalse);
    expect(pendingTrue).toBe(false);
  });
});

describe("isStoreAddressCommitted and isKnownInOnlineStore must NOT collapse into the same signal (E-013)", () => {
  it("all four firstPublishPending x slugQab combinations, including the new state B", () => {
    const matrix = [
      { firstPublishPending: true, slugQab: null, committed: false, known: false },
      { firstPublishPending: true, slugQab: "la-rampa-2", committed: false, known: true },
      // State B (§9): published, address frozen, value still unknown.
      { firstPublishPending: false, slugQab: null, committed: true, known: false },
      { firstPublishPending: false, slugQab: "la-rampa-2", committed: true, known: true },
    ];

    for (const row of matrix) {
      const local = baseLocal({ firstPublishPending: row.firstPublishPending, slugQab: row.slugQab });
      expect(isStoreAddressCommitted(local)).toBe(row.committed);
      expect(isKnownInOnlineStore(local)).toBe(row.known);
    }
  });

  it("should reach a state where committed is true and known is false at once — the two signals are independent", () => {
    const local = baseLocal({ firstPublishPending: false, slugQab: null });
    expect(isStoreAddressCommitted(local)).toBe(true);
    expect(isKnownInOnlineStore(local)).toBe(false);
  });
});

describe("onlineStoreUrl", () => {
  it("should be null when the local is not known in the online store", () => {
    expect(onlineStoreUrl(baseLocal({ slugQab: null }))).toBeNull();
  });

  it("should be null even when firstPublishPending is false, as long as slugQab stays null — state B has no URL to show", () => {
    expect(onlineStoreUrl(baseLocal({ firstPublishPending: false, slugQab: null }))).toBeNull();
  });

  it("should be QAB_PUBLIC_STORE_URL_PREFIX + slugQab when known", () => {
    const local = baseLocal({ slugQab: "la-rampa-2" });
    expect(onlineStoreUrl(local)).toBe(`${QAB_PUBLIC_STORE_URL_PREFIX}la-rampa-2`);
  });

  it("should be built from slugQab, NEVER from local.slug — the merchant-requested value is not the public address", () => {
    const local = baseLocal({ slug: "la-rampa", slugQab: "la-rampa-2" });
    expect(onlineStoreUrl(local)).toBe(`${QAB_PUBLIC_STORE_URL_PREFIX}la-rampa-2`);
    expect(onlineStoreUrl(local)).not.toBe(`${QAB_PUBLIC_STORE_URL_PREFIX}la-rampa`);
  });
});

describe("assignedSlugNotice", () => {
  it("should be null when the local is not known in the online store", () => {
    expect(assignedSlugNotice(baseLocal({ slugQab: null, slug: "la-rampa" }))).toBeNull();
  });

  it("should be null when there is no requested slug at all (slug: null)", () => {
    expect(assignedSlugNotice(baseLocal({ slug: null, slugQab: "la-rampa-2" }))).toBeNull();
  });

  it("should be null when the requested and assigned slugs are EQUAL — the discriminating control", () => {
    expect(
      assignedSlugNotice(baseLocal({ slug: "otra-direccion", slugQab: "otra-direccion" }))
    ).toBeNull();
  });

  it('should be the literal divergence sentence when they differ — acceptance criterion 3', () => {
    const local = baseLocal({ slug: "la-rampa", slugQab: "la-rampa-2" });
    expect(assignedSlugNotice(local)).toBe(
      "Pediste «la-rampa» y te asignaron «la-rampa-2»: alguien ya tenía la que pediste."
    );
  });

  it("should NOT collapse the equal and divergent branches into the same result", () => {
    const equal = assignedSlugNotice(baseLocal({ slug: "otra-direccion", slugQab: "otra-direccion" }));
    const divergent = assignedSlugNotice(baseLocal({ slug: "la-rampa", slugQab: "la-rampa-2" }));

    expect(equal).toBeNull();
    expect(divergent).not.toBeNull();
  });
});
