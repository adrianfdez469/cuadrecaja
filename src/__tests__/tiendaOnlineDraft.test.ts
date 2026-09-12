import { describe, it, expect } from "vitest";
import {
  emptyContactFieldsNotice,
  emptyContactFields,
  CONTACT_FIELD_LABELS,
  collectPurchaseConfigIssues,
  draftFromLocal,
  draftToUpdate,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";
import {
  QAB_CHECKOUT_MODE_DEFAULT,
  QAB_DELIVERY_ENABLED_DEFAULT,
  QAB_DELIVERY_FEE_MODE_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_DEFAULT,
  QAB_DELIVERY_FEE_MAX_EXCLUSIVE,
} from "@/constants/qab";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";

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
    // F-016: the five purchase-configuration fields. Consistent defaults (delivery
    // disabled) so this fixture never trips collectPurchaseConfigIssues's contradiction
    // rule on its own.
    checkoutMode: QAB_CHECKOUT_MODE_DEFAULT,
    deliveryEnabled: QAB_DELIVERY_ENABLED_DEFAULT,
    deliveryFee: "",
    deliveryFeeMode: QAB_DELIVERY_FEE_MODE_DEFAULT,
    orderExpiryHours: String(QAB_ORDER_EXPIRY_HOURS_DEFAULT),
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

/**
 * F-016 (contract § 7) — `collectPurchaseConfigIssues`, the form's half of the invariant.
 * Order and exclusivity are fixed by the contract because a test compares arrays:
 *
 *   1. deliveryFee (AT MOST ONE issue, checked in this order): blank -> no issue · not
 *      finite -> DELIVERY_FEE_NOT_A_NUMBER · negative -> DELIVERY_FEE_NEGATIVE · more than
 *      two decimals -> DELIVERY_FEE_TOO_MANY_DECIMALS · too large -> DELIVERY_FEE_TOO_LARGE.
 *   2. orderExpiryHours (AT MOST ONE): blank/non-finite/fractional ->
 *      ORDER_EXPIRY_HOURS_NOT_AN_INTEGER · out of range -> ORDER_EXPIRY_HOURS_OUT_OF_RANGE.
 *   3. the contradiction, ONLY when deliveryFee produced NO issue of its own.
 */
describe("collectPurchaseConfigIssues", () => {
  it("should return an empty array for a well formed, consistent draft", () => {
    expect(collectPurchaseConfigIssues(baseDraft())).toEqual([]);
  });

  it("should treat a blank deliveryFee as \"no amount\", not an error, when delivery is off", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ deliveryFee: "" }))).toEqual([]);
  });

  it("should report DELIVERY_FEE_NOT_A_NUMBER for a non-numeric deliveryFee", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ deliveryFee: "abc" }))).toEqual([
      { code: "DELIVERY_FEE_NOT_A_NUMBER", field: "deliveryFee" },
    ]);
  });

  it("should report DELIVERY_FEE_NEGATIVE for a negative deliveryFee", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ deliveryFee: "-3" }))).toEqual([
      { code: "DELIVERY_FEE_NEGATIVE", field: "deliveryFee" },
    ]);
  });

  it("should report DELIVERY_FEE_TOO_MANY_DECIMALS for 12.345", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ deliveryFee: "12.345" }))).toEqual([
      { code: "DELIVERY_FEE_TOO_MANY_DECIMALS", field: "deliveryFee" },
    ]);
  });

  it("should report DELIVERY_FEE_TOO_LARGE at the exclusive ceiling", () => {
    expect(
      collectPurchaseConfigIssues(baseDraft({ deliveryFee: String(QAB_DELIVERY_FEE_MAX_EXCLUSIVE) }))
    ).toEqual([{ code: "DELIVERY_FEE_TOO_LARGE", field: "deliveryFee" }]);
  });

  it("should report ORDER_EXPIRY_HOURS_NOT_AN_INTEGER for blank, non-numeric and fractional values", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "" }))).toEqual([
      { code: "ORDER_EXPIRY_HOURS_NOT_AN_INTEGER", field: "orderExpiryHours" },
    ]);
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "abc" }))).toEqual([
      { code: "ORDER_EXPIRY_HOURS_NOT_AN_INTEGER", field: "orderExpiryHours" },
    ]);
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "12.5" }))).toEqual([
      { code: "ORDER_EXPIRY_HOURS_NOT_AN_INTEGER", field: "orderExpiryHours" },
    ]);
  });

  it("should report ORDER_EXPIRY_HOURS_OUT_OF_RANGE for 0 and 8761", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "0" }))).toEqual([
      { code: "ORDER_EXPIRY_HOURS_OUT_OF_RANGE", field: "orderExpiryHours" },
    ]);
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "8761" }))).toEqual([
      { code: "ORDER_EXPIRY_HOURS_OUT_OF_RANGE", field: "orderExpiryHours" },
    ]);
  });

  it("should accept the two range ends, 1 and 8760, with no issue", () => {
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "1" }))).toEqual([]);
    expect(collectPurchaseConfigIssues(baseDraft({ orderExpiryHours: "8760" }))).toEqual([]);
  });

  it("should report the contradiction when delivery is on, the mode is FLAT_RATE and the amount is blank", () => {
    expect(
      collectPurchaseConfigIssues(
        baseDraft({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE", deliveryFee: "" })
      )
    ).toEqual([{ code: "DELIVERY_CONFIG_INCONSISTENT", field: "deliveryFee" }]);
  });

  it("should NOT report the contradiction when delivery is off — the discriminating control on deliveryEnabled", () => {
    expect(
      collectPurchaseConfigIssues(
        baseDraft({ deliveryEnabled: false, deliveryFeeMode: "FLAT_RATE", deliveryFee: "" })
      )
    ).toEqual([]);
  });

  it("should NOT report the contradiction for QUOTED_PER_ORDER — the discriminating control on deliveryFeeMode", () => {
    expect(
      collectPurchaseConfigIssues(
        baseDraft({ deliveryEnabled: true, deliveryFeeMode: "QUOTED_PER_ORDER", deliveryFee: "" })
      )
    ).toEqual([]);
  });

  it("should NOT report the contradiction when there IS an amount", () => {
    expect(
      collectPurchaseConfigIssues(
        baseDraft({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE", deliveryFee: "100" })
      )
    ).toEqual([]);
  });

  it("exclusivity: should report ONLY the deliveryFee issue, never ALSO the contradiction, when deliveryFee itself is invalid (not blank)", () => {
    // A non-blank, non-finite deliveryFee is not "no amount" — it is a distinct, reportable
    // error on the same field. The contradiction rule only applies when deliveryFee produced
    // NO issue of its own, so a naive implementation that treats "invalid" the same as "blank"
    // for the contradiction check would wrongly emit BOTH codes here.
    expect(
      collectPurchaseConfigIssues(
        baseDraft({ deliveryEnabled: true, deliveryFeeMode: "FLAT_RATE", deliveryFee: "abc" })
      )
    ).toEqual([{ code: "DELIVERY_FEE_NOT_A_NUMBER", field: "deliveryFee" }]);
  });

  it("order: an orderExpiryHours issue comes before the contradiction when both apply", () => {
    const draft = baseDraft({
      deliveryEnabled: true,
      deliveryFeeMode: "FLAT_RATE",
      deliveryFee: "",
      orderExpiryHours: "0",
    });

    expect(collectPurchaseConfigIssues(draft)).toEqual([
      { code: "ORDER_EXPIRY_HOURS_OUT_OF_RANGE", field: "orderExpiryHours" },
      { code: "DELIVERY_CONFIG_INCONSISTENT", field: "deliveryFee" },
    ]);
  });

  it("order: a deliveryFee issue comes before an orderExpiryHours issue when both apply", () => {
    const draft = baseDraft({ deliveryFee: "12.345", orderExpiryHours: "0" });

    expect(collectPurchaseConfigIssues(draft)).toEqual([
      { code: "DELIVERY_FEE_TOO_MANY_DECIMALS", field: "deliveryFee" },
      { code: "ORDER_EXPIRY_HOURS_OUT_OF_RANGE", field: "orderExpiryHours" },
    ]);
  });
});

/**
 * F-016 (contract § 7) — the five fields added to `draftFromLocal` / `draftToUpdate`. The two
 * numeric fields are strings on the draft, like every other numeric field of this form; the
 * two enums are typed, since they come from a closed control.
 */
describe("draftFromLocal / draftToUpdate — F-016 purchase configuration fields", () => {
  function baseLocal(overrides: Partial<ITiendaOnlineLocal> = {}): ITiendaOnlineLocal {
    return {
      id: "a3f1a1a1-1111-4111-8111-111111111111",
      nombre: "Sucursal Vedado",
      tipo: "TIENDA",
      publicarEnTienda: true,
      slug: "sucursal-vedado",
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
      firstPublishPending: false,
      syncState: { state: "SYNCED", code: null, attempts: 0, since: null },
      checkoutMode: QAB_CHECKOUT_MODE_DEFAULT,
      deliveryEnabled: QAB_DELIVERY_ENABLED_DEFAULT,
      deliveryFee: null,
      deliveryFeeMode: QAB_DELIVERY_FEE_MODE_DEFAULT,
      orderExpiryHours: QAB_ORDER_EXPIRY_HOURS_DEFAULT,
      ...overrides,
    } as ITiendaOnlineLocal;
  }

  it("draftFromLocal should carry the two enums through untouched", () => {
    const draft = draftFromLocal(
      baseLocal({ checkoutMode: "ONSITE", deliveryFeeMode: "QUOTED_PER_ORDER" })
    );
    expect(draft.checkoutMode).toBe("ONSITE");
    expect(draft.deliveryFeeMode).toBe("QUOTED_PER_ORDER");
  });

  it("draftFromLocal should turn deliveryFee: null into an empty string", () => {
    const draft = draftFromLocal(baseLocal({ deliveryFee: null }));
    expect(draft.deliveryFee).toBe("");
  });

  it("draftFromLocal should turn a real deliveryFee into its plain string form", () => {
    const draft = draftFromLocal(baseLocal({ deliveryFee: 150 }));
    expect(draft.deliveryFee).toBe("150");
  });

  it("draftFromLocal should turn orderExpiryHours into a string, never dropping it", () => {
    const draft = draftFromLocal(baseLocal({ orderExpiryHours: 48 }));
    expect(draft.orderExpiryHours).toBe("48");
  });

  it("draftToUpdate should turn a blank deliveryFee into null and a filled one into a number", () => {
    expect(draftToUpdate(baseDraft({ deliveryFee: "" })).deliveryFee).toBeNull();
    expect(draftToUpdate(baseDraft({ deliveryFee: "150" })).deliveryFee).toBe(150);
  });

  it("draftToUpdate should turn a blank orderExpiryHours into NaN, never 0 — Number('') would silently be 0", () => {
    expect(draftToUpdate(baseDraft({ orderExpiryHours: "" })).orderExpiryHours).toBeNaN();
  });

  it("draftToUpdate should turn a filled orderExpiryHours into its number", () => {
    expect(draftToUpdate(baseDraft({ orderExpiryHours: "48" })).orderExpiryHours).toBe(48);
  });

  it("draftToUpdate should ALWAYS send deliveryFee and deliveryFeeMode, even when delivery is disabled — a hidden field must not lose its value", () => {
    const draft = baseDraft({ deliveryEnabled: false, deliveryFeeMode: "QUOTED_PER_ORDER", deliveryFee: "150" });
    const update = draftToUpdate(draft);

    expect(update.deliveryFeeMode).toBe("QUOTED_PER_ORDER");
    expect(update.deliveryFee).toBe(150);
  });

  it("round trip: local -> draft -> update reconstructs the same five values, with no loss", () => {
    const local = baseLocal({
      checkoutMode: "ONSITE",
      deliveryEnabled: true,
      deliveryFee: 275.5,
      deliveryFeeMode: "QUOTED_PER_ORDER",
      orderExpiryHours: 72,
    });

    const update = draftToUpdate(draftFromLocal(local));

    expect(update.checkoutMode).toBe("ONSITE");
    expect(update.deliveryEnabled).toBe(true);
    expect(update.deliveryFee).toBe(275.5);
    expect(update.deliveryFeeMode).toBe("QUOTED_PER_ORDER");
    expect(update.orderExpiryHours).toBe(72);
  });
});
