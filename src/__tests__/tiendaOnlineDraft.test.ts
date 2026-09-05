import { describe, it, expect } from "vitest";
import {
  emptyContactFieldsNotice,
  emptyContactFields,
  CONTACT_FIELD_LABELS,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

/**
 * F-020 — `emptyContactFieldsNotice`, the one new function of `src/utils/tiendaOnlineDraft.ts`
 * (contract §10b). It composes the count-banner sentence as ONE string so the suite can pin the
 * exact copy that a `.tsx` would put out of reach (same reasoning as `publicationPresentation.ts`).
 *
 * NOTE for the implementer / arch-guardian: at the time this file was written, no test file for
 * `src/utils/tiendaOnlineDraft.ts` existed in `src/__tests__/`, even though the contract (§10b)
 * and the F-020 spec both say `emptyContactFields` and `CONTACT_FIELD_LABELS` already "tienen
 * tests" and must not be touched. This file does NOT add coverage for those pre-existing
 * functions — only for the new one — and reports the discrepancy rather than inventing tests
 * for functions this feature does not own.
 *
 * The expected sentence is built from the REAL `emptyContactFields` / `CONTACT_FIELD_LABELS`
 * rather than hardcoded, so this test exercises the actual field order and labels instead of a
 * guess that could quietly diverge from them.
 *
 * SINGULAR FIX (post-delivery correction, decided by the human within F-020, not a separate
 * feature): the plural-only copy read "1 datos están vacíos..." for exactly one empty field —
 * grammatically wrong and visible to the merchant in the most dangerous case (one field cleared
 * by accident). `.agents/designs/F-020.md` ("Preguntas abiertas") proposed the singular form
 * without adopting it; the human adopted it verbatim:
 *   "1 dato está vacío y se va a borrar de tu tienda online: {nombre}." + the same unchanged
 *   second sentence.
 * `expectedNotice` below branches on count so N===1 is checked against the singular form and
 * N>=2 against the plural — a single-branch test would pass an implementation that always
 * returns one or the other (E-008, twice already in this feature: see `.agents/errors/`).
 */

function baseDraft(overrides: Partial<ITiendaOnlineDraft> = {}): ITiendaOnlineDraft {
  return {
    publicarEnTienda: true,
    slug: "la-rampa",
    descripcion: "Bodega de barrio",
    direccion: "Calle 23",
    ciudad: "La Habana",
    provincia: "La Habana",
    latitud: "23.1",
    longitud: "-82.3",
    telefono: "+5350000000",
    whatsapp: "+5350000000",
    email: "tienda@example.com",
    horarios: null,
    motivoDespublicacion: "",
    ...overrides,
  };
}

const CLOSING_SENTENCE =
  "La tienda online no distingue «no lo toques» de «bórralo»: lo que quede vacío aquí desaparece de allá en el próximo envío.";

function expectedNotice(draft: ITiendaOnlineDraft): string {
  const empty = emptyContactFields(draft);
  const names = empty.map((field) => CONTACT_FIELD_LABELS[field]).join(", ");
  const lead =
    empty.length === 1
      ? "1 dato está vacío y se va a borrar de tu tienda online"
      : `${empty.length} datos están vacíos y se van a borrar de tu tienda online`;
  return `${lead}: ${names}. ${CLOSING_SENTENCE}`;
}

describe("emptyContactFieldsNotice", () => {
  it("should return null when no contact field is empty", () => {
    const draft = baseDraft();
    expect(emptyContactFields(draft)).toHaveLength(0); // sanity check on the fixture itself
    expect(emptyContactFieldsNotice(draft)).toBeNull();
  });

  it("should return the composed sentence, in SINGULAR grammar, for a single empty field", () => {
    const draft = baseDraft({ telefono: "" });

    expect(emptyContactFieldsNotice(draft)).toBe(expectedNotice(draft));
    expect(emptyContactFieldsNotice(draft)).toContain(CONTACT_FIELD_LABELS.telefono);
  });

  it('should match the human-adopted literal singular copy EXACTLY: "1 dato está vacío y se va a borrar de tu tienda online: {nombre}." + the unchanged second sentence', () => {
    const draft = baseDraft({ telefono: "" });

    expect(emptyContactFieldsNotice(draft)).toBe(
      `1 dato está vacío y se va a borrar de tu tienda online: ${CONTACT_FIELD_LABELS.telefono}. ${CLOSING_SENTENCE}`
    );
  });

  it("should use SINGULAR for exactly one empty field and PLURAL for two or more — the discriminating regression test for the copy fix", () => {
    // An implementation that always returns one of the two forms would pass a
    // single-branch test. Asserting both branches, on the SAME draft shape
    // varied only by count, is what makes this catch that (E-008).
    const singular = emptyContactFieldsNotice(baseDraft({ telefono: "" }));
    const plural = emptyContactFieldsNotice(baseDraft({ telefono: "", whatsapp: "" }));

    expect(singular).toContain("1 dato está vacío");
    expect(singular).not.toContain("datos están vacíos");
    expect(singular).not.toContain("se van a borrar");
    expect(singular).toContain("se va a borrar");

    expect(plural).toContain("2 datos están vacíos");
    expect(plural).toContain("se van a borrar");
    expect(plural).not.toContain("dato está vacío");
    expect(plural).not.toContain("se va a borrar");
  });

  it("should list every empty field's label, in the order emptyContactFields returns them, separated by ', '", () => {
    const draft = baseDraft({ telefono: "", whatsapp: "", email: "" });

    const notice = emptyContactFieldsNotice(draft);
    expect(notice).toBe(expectedNotice(draft));
    expect(notice).toContain(
      `${CONTACT_FIELD_LABELS.telefono}, ${CONTACT_FIELD_LABELS.whatsapp}, ${CONTACT_FIELD_LABELS.email}`
    );
    expect(notice).toContain("3 datos están vacíos");
  });

  it("should include the fixed closing sentence about the online store not distinguishing the two kinds of empty", () => {
    const draft = baseDraft({ direccion: "" });

    expect(emptyContactFieldsNotice(draft)).toContain(
      "La tienda online no distingue «no lo toques» de «bórralo»: lo que quede vacío aquí desaparece de allá en el próximo envío."
    );
  });

  it("should NOT return a fixed/constant string regardless of which fields are empty — the discriminating control", () => {
    const oneEmpty = emptyContactFieldsNotice(baseDraft({ telefono: "" }));
    const twoEmpty = emptyContactFieldsNotice(baseDraft({ telefono: "", whatsapp: "" }));

    expect(oneEmpty).not.toBeNull();
    expect(twoEmpty).not.toBeNull();
    expect(oneEmpty).not.toBe(twoEmpty);
  });

  it("should recompute from a whitespace-only field as empty too, consistent with emptyContactFields", () => {
    const draft = baseDraft({ ciudad: "   " });

    expect(emptyContactFields(draft)).toContain("ciudad");
    expect(emptyContactFieldsNotice(draft)).toBe(expectedNotice(draft));
  });

  it("should treat all nine contact fields empty the same way — count and full label list", () => {
    const draft = baseDraft({
      descripcion: "",
      direccion: "",
      ciudad: "",
      provincia: "",
      latitud: "",
      longitud: "",
      telefono: "",
      whatsapp: "",
      email: "",
    });

    expect(emptyContactFields(draft)).toHaveLength(9);
    expect(emptyContactFieldsNotice(draft)).toBe(expectedNotice(draft));
    expect(emptyContactFieldsNotice(draft)).toContain("9 datos están vacíos");
  });
});
