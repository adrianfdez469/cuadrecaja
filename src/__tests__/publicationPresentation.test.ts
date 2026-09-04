import { describe, it, expect } from "vitest";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";

/**
 * F-005, ciclo 2 — `src/components/tiendaOnline/publicationPresentation.ts`.
 *
 * This is the pure function the ciclo-1 defect went through undetected: the
 * screen used `slugQab !== null` as "has this ever been published", and
 * nothing writes that column, so a published-then-unpublished local kept
 * showing "Sin publicar" instead of "Despublicado" (acceptance criterion 6,
 * plus design criteria 14 and 45).
 *
 * It was originally exported from `PublicationStatusCard.tsx`, which made it
 * unreachable from this suite: the project's `tsconfig.json` sets
 * `"jsx": "preserve"` and `vitest.config.ts` has no `esbuild.jsx` override, so
 * Vite fails to parse ANY `.tsx` file at all (reproduced independently against
 * `@/components/ContentCard`, unrelated to F-005 — not a defect of this file).
 * The `implementer` moved the function to this plain `.ts` module for exactly
 * that reason; `PublicationStatusCard.tsx` now re-exports it for compatibility
 * but this suite imports the `.ts` module directly, never the component, so it
 * never touches that wall again.
 *
 * The contract (`.agents/specs/F-005.md` §4, ADR 0035) fixes the correct
 * source: `firstPublishPending` is "no STORE event of this local ever carried
 * `publishToStore: true`", NOT `slugQab`. Every fixture below sets `slugQab` to
 * `null` on purpose — the presentation must never need that column to tell
 * "never published" from "unpublished".
 */

const { publicationPresentation } = await import(
  "@/components/tiendaOnline/publicationPresentation"
);

function baseLocal(overrides: Partial<ITiendaOnlineLocal> = {}): ITiendaOnlineLocal {
  return {
    id: "a3f1a1a1-1111-4111-8111-111111111111",
    nombre: "Sucursal Centro",
    tipo: "TIENDA",
    publicarEnTienda: true,
    slug: "sucursal-centro",
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

describe("publicationPresentation — the four publicarEnTienda x firstPublishPending combinations", () => {
  it('should present "Publicado" (positive) when publicarEnTienda is true and firstPublishPending is true', () => {
    const presentation = publicationPresentation(
      baseLocal({ firstPublishPending: true }),
      true
    );

    expect(presentation.label).toBe("Publicado");
    expect(presentation.hue).toBe("positive");
  });

  it('should present "Publicado" (positive) when publicarEnTienda is true and firstPublishPending is false', () => {
    const presentation = publicationPresentation(
      baseLocal({ firstPublishPending: false }),
      true
    );

    expect(presentation.label).toBe("Publicado");
    expect(presentation.hue).toBe("positive");
  });

  it('should present "Sin publicar" (neutral) when publicarEnTienda is false and firstPublishPending is true — never published', () => {
    const presentation = publicationPresentation(
      baseLocal({ firstPublishPending: true }),
      false
    );

    expect(presentation.label).toBe("Sin publicar");
    expect(presentation.hue).toBe("neutral");
  });

  it('should present "Despublicado" (caution) when publicarEnTienda is false and firstPublishPending is false — THE ciclo-1 defect', () => {
    // This is the exact combination the browser caught and no test did: a
    // local that already published at least once and is now off must read as
    // "unpublished", never fall back to the initial "not published yet" state.
    const presentation = publicationPresentation(
      baseLocal({ firstPublishPending: false }),
      false
    );

    expect(presentation.label).toBe("Despublicado");
    expect(presentation.hue).toBe("caution");
  });

  it('should NOT collapse "Sin publicar" and "Despublicado" into the same presentation', () => {
    // A test that only ever exercised one of the two firstPublishPending
    // branches with publicarEnTienda: false would still pass against the
    // broken implementation (constant "Sin publicar" regardless of history).
    // Asserting the two differ is what makes that impossible.
    const neverPublished = publicationPresentation(
      baseLocal({ firstPublishPending: true }),
      false
    );
    const unpublishedAfterPublishing = publicationPresentation(
      baseLocal({ firstPublishPending: false }),
      false
    );

    expect(neverPublished.label).not.toBe(unpublishedAfterPublishing.label);
    expect(neverPublished.hue).not.toBe(unpublishedAfterPublishing.hue);
  });

  it("should ignore slugQab entirely — the column the ciclo-1 defect used and nothing writes", () => {
    // Same firstPublishPending, opposite slugQab: the presentation must be
    // identical. If it ever reads slugQab again this pins it down immediately.
    const withSlugQab = publicationPresentation(
      baseLocal({ firstPublishPending: false, slugQab: "sucursal-centro" }),
      false
    );
    const withoutSlugQab = publicationPresentation(
      baseLocal({ firstPublishPending: false, slugQab: null }),
      false
    );

    expect(withSlugQab).toEqual(withoutSlugQab);
    expect(withSlugQab.label).toBe("Despublicado");
  });

  it("should return a non-empty switchLabel for every one of the four combinations", () => {
    for (const publicarEnTienda of [true, false]) {
      for (const firstPublishPending of [true, false]) {
        const presentation = publicationPresentation(
          baseLocal({ firstPublishPending }),
          publicarEnTienda
        );
        expect(typeof presentation.switchLabel).toBe("string");
        expect(presentation.switchLabel.length).toBeGreaterThan(0);
      }
    }
  });
});
