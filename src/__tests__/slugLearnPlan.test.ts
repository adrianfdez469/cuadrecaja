import { describe, it, expect } from "vitest";
import {
  decideQabSlugLearning,
  qabSlugLearnQuery,
  groupQabSlugLearningTargetsByNegocio,
  orderQabSlugLearningTargets,
  assertQabSlugLearningTenant,
} from "@/lib/qab/slugLearnPlan";
import { QabTenantMismatchError } from "@/lib/qab/outboxAck";
import { QAB_SLUG_LEARNED_REASON, QAB_SLUG_QUERY_MAX_LENGTH } from "@/constants/qab";
import type { IQabSlugOutcome } from "@/lib/qab/qabSlugClient";
import type { IQabAppliedStorePublish, IQabSlugLearningTarget } from "@/schemas/qabSync";

/**
 * F-020 — `src/lib/qab/slugLearnPlan.ts` (contract §5), the module the contract itself
 * calls out as the one `dev-tester` can test directly: no network, no database, no `.tsx`.
 *
 * Two decisions carry the most risk and get the most attention here (ADR 0037):
 *
 *  - `decideQabSlugLearning`'s guard ORDER. A `reason` other than "own" must win over a
 *    perfectly valid `resolvedSlug` (guard 2 before guard 3), and an upstream error must win
 *    over everything (guard 1 first). Testing only the happy path would pass a reordered,
 *    broken implementation just as well (E-008).
 *  - The written value NEVER comes from anything but `outcome.forecast.resolvedSlug` of THAT
 *    call — never `candidate`, never a value smuggled in from elsewhere. This is what makes
 *    the "stale forecast" trap of acceptance criterion 1 fail loudly if reintroduced.
 */

function okOutcome(overrides: Record<string, unknown> = {}): IQabSlugOutcome {
  return {
    kind: "ok",
    forecast: {
      candidate: "la-rampa",
      available: false,
      reason: QAB_SLUG_LEARNED_REASON,
      resolvedSlug: "la-rampa-2",
      url: "https://queandabuscando.com/la-rampa-2",
      storeKnown: true,
      ...overrides,
    },
  } as IQabSlugOutcome;
}

function target(overrides: Partial<IQabSlugLearningTarget> = {}): IQabSlugLearningTarget {
  return {
    negocioId: "negocio-a",
    tiendaId: "tienda-1",
    slug: "la-rampa",
    nombre: "Sucursal Centro",
    ...overrides,
  };
}

describe("decideQabSlugLearning — the four outcomes and their guard ORDER (ADR 0037)", () => {
  it('should return { kind: "upstream_error", code } when the outcome is not "ok"', () => {
    const outcome: IQabSlugOutcome = { kind: "error", code: "TRANSPORT" };

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "upstream_error", code: "TRANSPORT" });
  });

  it('should return upstream_error and NEVER read the body, even if a forecast were smuggled onto the error outcome', () => {
    // Guard 1 runs before anything else touches the body. A `{ kind: "error" }` value has no
    // `forecast` in its type, but if a future refactor smuggled one on anyway, the guard order
    // must still win: it must never become "write" just because a body-shaped object is present.
    const smuggled = {
      kind: "error",
      code: "TRANSPORT",
      forecast: { reason: QAB_SLUG_LEARNED_REASON, resolvedSlug: "la-rampa-2" },
    } as unknown as IQabSlugOutcome;

    expect(decideQabSlugLearning(smuggled)).toEqual({ kind: "upstream_error", code: "TRANSPORT" });
  });

  it('should return { kind: "not_own" } when reason is "taken", even with a PERFECTLY VALID resolvedSlug', () => {
    // This is the test that proves guard 2 runs before guard 3: a broken implementation that
    // read resolvedSlug first and only checked `reason` afterwards (or not at all) would pass
    // this outcome through as "write".
    const outcome = okOutcome({ reason: "taken", resolvedSlug: "la-rampa-9" });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "not_own" });
  });

  it.each(["free", "reserved", "retired", "invalid", "some-future-reason"])(
    'should return not_own for reason "%s" — any reason other than "own"',
    (reason) => {
      const outcome = okOutcome({ reason, resolvedSlug: "la-rampa-2" });

      expect(decideQabSlugLearning(outcome)).toEqual({ kind: "not_own" });
    }
  );

  it.each(["La Rampa!!", "", "a".repeat(81), "a--b", "-a-b", "a-b-", "A-B"])(
    'should return { kind: "invalid_slug" } when reason is "own" but resolvedSlug "%s" fails qabSlugSchema',
    (resolvedSlug) => {
      const outcome = okOutcome({ reason: QAB_SLUG_LEARNED_REASON, resolvedSlug });

      expect(decideQabSlugLearning(outcome)).toEqual({ kind: "invalid_slug" });
    }
  );

  it("should return invalid_slug when resolvedSlug is null — a body malformed beyond what the wire schema promises", () => {
    // qabSlugSchema is z.unknown().transform(...): it must reject a non-string
    // just as reliably as a badly-shaped string, since decideQabSlugLearning has
    // no other guard for the TYPE of resolvedSlug.
    const outcome = okOutcome({ reason: QAB_SLUG_LEARNED_REASON, resolvedSlug: null });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "invalid_slug" });
  });

  it("should return invalid_slug when resolvedSlug is a number, not a string", () => {
    const outcome = okOutcome({ reason: QAB_SLUG_LEARNED_REASON, resolvedSlug: 12345 });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "invalid_slug" });
  });

  it('should return { kind: "write", slugQab } with the exact resolvedSlug when reason is "own" and it is a valid slug', () => {
    const outcome = okOutcome({ reason: QAB_SLUG_LEARNED_REASON, resolvedSlug: "la-rampa-2" });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "write", slugQab: "la-rampa-2" });
  });

  it("should write the resolvedSlug of THIS call even when it differs from candidate — acceptance criterion 1's stale-forecast trap", () => {
    // candidate is what the merchant asked for; resolvedSlug is what QAB actually assigned.
    // A broken implementation that fell back to `candidate` would pass every case where they
    // happen to be equal and only fail this one.
    const outcome = okOutcome({
      candidate: "la-rampa",
      reason: QAB_SLUG_LEARNED_REASON,
      resolvedSlug: "la-rampa-4",
    });

    const decision = decideQabSlugLearning(outcome);

    expect(decision).toEqual({ kind: "write", slugQab: "la-rampa-4" });
  });

  it("should accept a resolvedSlug equal to the candidate too — the free-slug control that discriminates copying Tienda.slug from reading resolvedSlug", () => {
    const outcome = okOutcome({
      candidate: "otra-direccion",
      reason: QAB_SLUG_LEARNED_REASON,
      resolvedSlug: "otra-direccion",
    });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "write", slugQab: "otra-direccion" });
  });

  it("should never source slugQab from `url` — a decision built from `url` would diverge from this test", () => {
    const outcome = okOutcome({
      reason: QAB_SLUG_LEARNED_REASON,
      resolvedSlug: "la-rampa-2",
      url: "https://queandabuscando.com/some-other-slug-entirely",
    });

    expect(decideQabSlugLearning(outcome)).toEqual({ kind: "write", slugQab: "la-rampa-2" });
  });
});

describe("qabSlugLearnQuery — §5.2", () => {
  it("should send slug + storeId when the target has a requested slug, and never send name", () => {
    const query = qabSlugLearnQuery(target({ slug: "la-rampa", tiendaId: "tienda-1" }));

    expect(query).toEqual({ slug: "la-rampa", storeId: "tienda-1" });
    expect(query).not.toHaveProperty("name");
  });

  it("should send name + storeId when the target has no requested slug, and never send slug", () => {
    const query = qabSlugLearnQuery(
      target({ slug: null, nombre: "Sucursal Centro", tiendaId: "tienda-1" })
    );

    expect(query).toEqual({ name: "Sucursal Centro", storeId: "tienda-1" });
    expect(query).not.toHaveProperty("slug");
  });

  it("should ALWAYS send storeId — the whole point of this read, per criterion 1's stale-forecast trap", () => {
    expect(qabSlugLearnQuery(target({ slug: "la-rampa", tiendaId: "t-1" }))).toHaveProperty(
      "storeId",
      "t-1"
    );
    expect(qabSlugLearnQuery(target({ slug: null, tiendaId: "t-2" }))).toHaveProperty(
      "storeId",
      "t-2"
    );
  });

  it("should truncate a long nombre fallback to QAB_SLUG_QUERY_MAX_LENGTH", () => {
    const longName = "x".repeat(QAB_SLUG_QUERY_MAX_LENGTH + 50);
    const query = qabSlugLearnQuery(target({ slug: null, nombre: longName }));

    expect(query).toHaveProperty("name");
    expect((query as { name: string }).name).toHaveLength(QAB_SLUG_QUERY_MAX_LENGTH);
    expect((query as { name: string }).name).toBe("x".repeat(QAB_SLUG_QUERY_MAX_LENGTH));
  });

  it("should leave a short nombre untouched", () => {
    const query = qabSlugLearnQuery(target({ slug: null, nombre: "Sucursal Centro" }));

    expect((query as { name: string }).name).toBe("Sucursal Centro");
  });
});

describe("groupQabSlugLearningTargetsByNegocio — §5.3", () => {
  it("should group targets of a single business, keeping their given order", () => {
    const targets = [
      target({ tiendaId: "t-1" }),
      target({ tiendaId: "t-2" }),
      target({ tiendaId: "t-3" }),
    ];

    expect(groupQabSlugLearningTargetsByNegocio(targets)).toEqual([
      { negocioId: "negocio-a", targets },
    ]);
  });

  it("should order the groups by negocioId ascending, regardless of input order", () => {
    const targetB = target({ negocioId: "negocio-b", tiendaId: "t-b" });
    const targetA = target({ negocioId: "negocio-a", tiendaId: "t-a" });

    const groups = groupQabSlugLearningTargetsByNegocio([targetB, targetA]);

    expect(groups.map((g) => g.negocioId)).toEqual(["negocio-a", "negocio-b"]);
  });

  it("should partition two businesses' targets without mixing them", () => {
    const targetA1 = target({ negocioId: "negocio-a", tiendaId: "a-1" });
    const targetB1 = target({ negocioId: "negocio-b", tiendaId: "b-1" });
    const targetA2 = target({ negocioId: "negocio-a", tiendaId: "a-2" });

    const groups = groupQabSlugLearningTargetsByNegocio([targetA1, targetB1, targetA2]);

    expect(groups).toEqual([
      { negocioId: "negocio-a", targets: [targetA1, targetA2] },
      { negocioId: "negocio-b", targets: [targetB1] },
    ]);
  });

  it("should return [] for an empty input", () => {
    expect(groupQabSlugLearningTargetsByNegocio([])).toEqual([]);
  });
});

describe("orderQabSlugLearningTargets — §5.4, ADR 0036b: it ONLY reorders", () => {
  it("should return a permutation of targets: same length, same elements, when nothing applied", () => {
    const targets = [target({ tiendaId: "t-1" }), target({ tiendaId: "t-2" })];

    const ordered = orderQabSlugLearningTargets(targets, []);

    expect(ordered).toHaveLength(targets.length);
    expect(ordered).toEqual(expect.arrayContaining(targets));
    expect(targets).toEqual(expect.arrayContaining(ordered));
  });

  it("should NOT mutate the input `targets` array — a permutation check alone cannot tell a copy from an in-place sort", () => {
    const t1 = target({ negocioId: "negocio-a", tiendaId: "t-1" });
    const t2 = target({ negocioId: "negocio-a", tiendaId: "t-2" });
    const t3 = target({ negocioId: "negocio-a", tiendaId: "t-3" });
    const targets = [t1, t2, t3];
    const snapshotBeforeCall = [...targets];
    const applied: IQabAppliedStorePublish[] = [{ negocioId: "negocio-a", tiendaId: "t-3" }];

    const ordered = orderQabSlugLearningTargets(targets, applied);

    // The input array keeps its ORIGINAL order (t1, t2, t3), even though the
    // RETURNED array puts t3 first. An in-place sort would fail this.
    expect(targets).toEqual(snapshotBeforeCall);
    expect(targets).toEqual([t1, t2, t3]);
    expect(ordered).not.toBe(targets);
    expect(ordered[0]).toEqual(t3);
  });

  it("should put the target whose (negocioId, tiendaId) is in appliedStoreEvents FIRST", () => {
    const t1 = target({ negocioId: "negocio-a", tiendaId: "t-1" });
    const t2 = target({ negocioId: "negocio-a", tiendaId: "t-2" });
    const t3 = target({ negocioId: "negocio-a", tiendaId: "t-3" });
    const applied: IQabAppliedStorePublish[] = [{ negocioId: "negocio-a", tiendaId: "t-2" }];

    const ordered = orderQabSlugLearningTargets([t1, t2, t3], applied);

    expect(ordered[0]).toEqual(t2);
    expect(ordered).toHaveLength(3);
  });

  it("should keep the relative order WITHIN the applied half and WITHIN the remainder half", () => {
    const t1 = target({ negocioId: "negocio-a", tiendaId: "t-1" });
    const t2 = target({ negocioId: "negocio-a", tiendaId: "t-2" });
    const t3 = target({ negocioId: "negocio-a", tiendaId: "t-3" });
    const t4 = target({ negocioId: "negocio-a", tiendaId: "t-4" });
    const applied: IQabAppliedStorePublish[] = [
      { negocioId: "negocio-a", tiendaId: "t-3" },
      { negocioId: "negocio-a", tiendaId: "t-1" },
    ];

    const ordered = orderQabSlugLearningTargets([t1, t2, t3, t4], applied);

    // Applied half keeps t1 before t3 (their order in `targets`, not in `applied`);
    // remainder half keeps t2 before t4.
    expect(ordered).toEqual([t1, t3, t2, t4]);
  });

  it("should IGNORE an appliedStoreEvents entry whose pair is not in targets — it never widens the set", () => {
    const t1 = target({ negocioId: "negocio-a", tiendaId: "t-1" });
    const applied: IQabAppliedStorePublish[] = [
      { negocioId: "negocio-a", tiendaId: "t-1" },
      { negocioId: "negocio-a", tiendaId: "t-999-not-a-target" },
    ];

    const ordered = orderQabSlugLearningTargets([t1], applied);

    expect(ordered).toEqual([t1]);
  });

  it("should match by the FULL pair (negocioId AND tiendaId), never by tiendaId alone", () => {
    // Two different businesses happen to have the same tiendaId. Only negocio-b's target must
    // move to the front; negocio-a's same-tiendaId target must NOT be affected.
    const targetA = target({ negocioId: "negocio-a", tiendaId: "shared-id" });
    const targetB = target({ negocioId: "negocio-b", tiendaId: "shared-id" });
    const applied: IQabAppliedStorePublish[] = [{ negocioId: "negocio-b", tiendaId: "shared-id" }];

    const ordered = orderQabSlugLearningTargets([targetA, targetB], applied);

    expect(ordered).toEqual([targetB, targetA]);
  });

  it("should default to leaving order untouched when appliedStoreEvents is empty", () => {
    const targets = [target({ tiendaId: "t-1" }), target({ tiendaId: "t-2" })];

    expect(orderQabSlugLearningTargets(targets, [])).toEqual(targets);
  });
});

describe("assertQabSlugLearningTenant — §5.5", () => {
  it("should not throw when the target's negocioId matches", () => {
    expect(() =>
      assertQabSlugLearningTenant("negocio-a", target({ negocioId: "negocio-a" }))
    ).not.toThrow();
  });

  it("should throw QabTenantMismatchError when the target's negocioId does not match", () => {
    expect(() =>
      assertQabSlugLearningTenant("negocio-a", target({ negocioId: "negocio-b" }))
    ).toThrow(QabTenantMismatchError);
  });

  it("should return undefined (no value) when it does not throw", () => {
    expect(
      assertQabSlugLearningTenant("negocio-a", target({ negocioId: "negocio-a" }))
    ).toBeUndefined();
  });
});
