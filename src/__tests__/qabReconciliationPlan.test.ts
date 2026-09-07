import { describe, it, expect } from "vitest";
import {
  compareQabCatalogHashes,
  selectQabReconciliationTargets,
  qabStoreOutcomeReachedQab,
  aggregateQabBusinessAlertState,
  planQabAlertNotifications,
} from "@/lib/qab/qabReconciliationPlan";
import {
  QAB_RECONCILIATION_STORE_OUTCOMES,
  QAB_RECONCILIATION_REACHABLE_OUTCOMES,
  QAB_SYNC_STALE_THRESHOLD_MS,
  QAB_ALERT_NOTIFICATION_TTL_DAYS,
  QAB_ALERT_TITLES,
} from "@/constants/qab";
import type {
  IQabReconciliationTarget,
  IQabCatalogHash,
  IQabSyncStalenessRow,
  IQabBusinessAlertState,
  IQabReconciliationStoreOutcome,
} from "@/schemas/qabReconciliation";

/**
 * F-008 — `src/lib/qab/qabReconciliationPlan.ts` (contract § 4.2), against
 * `.agents/specs/F-008.md`. All pure, no database, no clock of its own: every `now` is
 * injected, so the ageing this feature needs (criteria 5 and 8) is testable without
 * waiting or a real database.
 *
 * `aggregateQabBusinessAlertState` carries criterion 8's whole isolation guarantee: a
 * stale business must not be masked by another business's healthy one, so every test of
 * it below follows E-008's rule of a positive, a negative, AND a third, unrelated
 * control business that must stay untouched — otherwise a guard wide enough to mark
 * every business stale (or none) would pass unnoticed.
 */

const QAB_HASH_A: IQabCatalogHash = { products: 4, hash: "62e399684e3a8eafadaae58391537955" };
const QAB_HASH_EMPTY: IQabCatalogHash = { products: 0, hash: "d41d8cd98f00b204e9800998ecf8427e" };

describe("compareQabCatalogHashes", () => {
  it('gives "match" when products and hash are both equal', () => {
    expect(compareQabCatalogHashes(QAB_HASH_A, { ...QAB_HASH_A })).toBe("match");
  });

  it('gives "diverged" when the hash differs, even with the same products', () => {
    expect(compareQabCatalogHashes(QAB_HASH_A, { ...QAB_HASH_A, hash: QAB_HASH_EMPTY.hash })).toBe(
      "diverged"
    );
  });

  it('gives "diverged" when products differs even with an equal hash — deliberately wider than § 5 (the branch nobody would remember to test, E-032)', () => {
    expect(compareQabCatalogHashes(QAB_HASH_A, { ...QAB_HASH_A, products: QAB_HASH_A.products + 1 })).toBe(
      "diverged"
    );
  });

  it('gives "diverged" when both products and hash differ', () => {
    expect(compareQabCatalogHashes(QAB_HASH_A, QAB_HASH_EMPTY)).toBe("diverged");
  });
});

function target(negocioId: string, tiendaId: string, ultimaComparacionAt: Date | null): IQabReconciliationTarget {
  return { negocioId, tiendaId, ultimaComparacionAt };
}

describe("selectQabReconciliationTargets", () => {
  const t1 = target("n1", "t1", null);
  const t2 = target("n1", "t2", new Date("2020-01-01T00:00:00.000Z"));
  const t3 = target("n1", "t3", new Date("2020-01-02T00:00:00.000Z"));
  const t4 = target("n2", "t4", null);
  const t5 = target("n2", "t5", new Date("2020-01-03T00:00:00.000Z"));

  it("orders never-compared stores first (tiebroken by tiendaId), then stalest first, tiendaId as the deterministic tiebreak", () => {
    const result = selectQabReconciliationTargets({
      candidates: [t3, t5, t2, t4, t1],
      maxPerBusiness: 50,
      maxTotal: 50,
    });

    expect(result.map((t) => t.tiendaId)).toEqual(["t1", "t4", "t2", "t3", "t5"]);
  });

  it("respects the per-business cap even when a business has more stores than it — the rest of ITS OWN stores are skipped, not just other businesses'", () => {
    const result = selectQabReconciliationTargets({
      candidates: [t1, t2, t3, t4, t5],
      maxPerBusiness: 1,
      maxTotal: 50,
    });

    // n1 has 3 candidates and n2 has 2: with the cap at 1 each, only the
    // stalest-first pick of EACH survives, never a second one from either.
    expect(result.map((t) => t.tiendaId)).toEqual(["t1", "t4"]);
  });

  it("respects the total cap even when no single business has hit its own per-business cap", () => {
    const result = selectQabReconciliationTargets({
      candidates: [t1, t2, t3, t4, t5],
      maxPerBusiness: 50,
      maxTotal: 3,
    });

    expect(result.map((t) => t.tiendaId)).toEqual(["t1", "t4", "t2"]);
  });

  it("returns [] for an empty candidate list", () => {
    expect(selectQabReconciliationTargets({ candidates: [] })).toEqual([]);
  });

  it("does not mutate the candidates array", () => {
    const candidates = [t3, t1, t2];
    const before = [...candidates];

    selectQabReconciliationTargets({ candidates });

    expect(candidates).toEqual(before);
  });
});

describe("qabStoreOutcomeReachedQab", () => {
  const expected: Record<IQabReconciliationStoreOutcome, boolean> = {
    match: true,
    diverged: true,
    unknown_store: true,
    upstream_error: false,
    too_large: false,
    skipped_deadline: false,
  };

  it.each(QAB_RECONCILIATION_STORE_OUTCOMES)("outcome %s", (outcome) => {
    expect(qabStoreOutcomeReachedQab(outcome)).toBe(expected[outcome]);
  });

  it("agrees exactly with QAB_RECONCILIATION_REACHABLE_OUTCOMES, the one place the set is written", () => {
    const reachable = QAB_RECONCILIATION_REACHABLE_OUTCOMES as readonly string[];
    for (const outcome of QAB_RECONCILIATION_STORE_OUTCOMES) {
      expect(qabStoreOutcomeReachedQab(outcome)).toBe(reachable.includes(outcome));
    }
  });
});

function stalenessRow(overrides: Partial<IQabSyncStalenessRow> = {}): IQabSyncStalenessRow {
  return {
    negocioId: "n1",
    tiendaId: "t1",
    nombre: "Tienda Uno",
    ultimoContactoOkAt: null,
    hashDivergenteAt: null,
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const NOW = new Date("2026-01-01T01:00:00.000Z");

describe("aggregateQabBusinessAlertState", () => {
  it("marks only the business past the threshold stale — with a THIRD, recent business as control against a too-wide guard (E-008)", () => {
    const rows: IQabSyncStalenessRow[] = [
      stalenessRow({ negocioId: "A", tiendaId: "tA", ultimoContactoOkAt: new Date(NOW.getTime() - 5 * 60_000) }),
      stalenessRow({ negocioId: "B", tiendaId: "tB", ultimoContactoOkAt: new Date(NOW.getTime() - 31 * 60_000) }),
      stalenessRow({ negocioId: "C", tiendaId: "tC", ultimoContactoOkAt: new Date(NOW.getTime() - 2 * 60_000) }),
    ];

    const result = aggregateQabBusinessAlertState({ rows, now: NOW });

    expect(result.find((s) => s.negocioId === "A")?.stale).toBe(false);
    expect(result.find((s) => s.negocioId === "B")?.stale).toBe(true);
    expect(result.find((s) => s.negocioId === "C")?.stale).toBe(false);
  });

  it("the window is exclusive: exactly QAB_SYNC_STALE_THRESHOLD_MS is NOT stale (>, not >=)", () => {
    const result = aggregateQabBusinessAlertState({
      rows: [
        stalenessRow({
          negocioId: "X",
          ultimoContactoOkAt: new Date(NOW.getTime() - QAB_SYNC_STALE_THRESHOLD_MS),
        }),
      ],
      now: NOW,
    });

    expect(result[0].stale).toBe(false);
  });

  it("one millisecond past QAB_SYNC_STALE_THRESHOLD_MS IS stale", () => {
    const result = aggregateQabBusinessAlertState({
      rows: [
        stalenessRow({
          negocioId: "X",
          ultimoContactoOkAt: new Date(NOW.getTime() - QAB_SYNC_STALE_THRESHOLD_MS - 1),
        }),
      ],
      now: NOW,
    });

    expect(result[0].stale).toBe(true);
  });

  it("falls back to createdAt when ultimoContactoOkAt is null: a business whose row is two minutes old is NOT stale yet", () => {
    const result = aggregateQabBusinessAlertState({
      rows: [
        stalenessRow({ negocioId: "NEW", ultimoContactoOkAt: null, createdAt: new Date(NOW.getTime() - 2 * 60_000) }),
      ],
      now: NOW,
    });

    expect(result[0].stale).toBe(false);
  });

  it("falls back to createdAt when ultimoContactoOkAt is null: a row an hour old that never contacted IS stale", () => {
    const result = aggregateQabBusinessAlertState({
      rows: [
        stalenessRow({ negocioId: "OLD", ultimoContactoOkAt: null, createdAt: new Date(NOW.getTime() - 60 * 60_000) }),
      ],
      now: NOW,
    });

    expect(result[0].stale).toBe(true);
  });

  it("produces exactly one entry per distinct negocioId present in rows — never one for a business absent from them", () => {
    const rows: IQabSyncStalenessRow[] = [
      stalenessRow({ negocioId: "A", tiendaId: "tA1" }),
      stalenessRow({ negocioId: "A", tiendaId: "tA2" }),
    ];

    const result = aggregateQabBusinessAlertState({ rows, now: NOW });

    expect(result).toHaveLength(1);
    expect(result[0].negocioId).toBe("A");
  });

  it("returns [] for rows: []", () => {
    expect(aggregateQabBusinessAlertState({ rows: [], now: NOW })).toEqual([]);
  });

  it("collects divergedTiendaIds and divergedNombres ascending by tiendaId, in the SAME order, excluding rows whose hashDivergenteAt is null", () => {
    const rows: IQabSyncStalenessRow[] = [
      stalenessRow({ negocioId: "A", tiendaId: "t2", nombre: "Tienda Dos", hashDivergenteAt: NOW, ultimoContactoOkAt: NOW }),
      stalenessRow({ negocioId: "A", tiendaId: "t1", nombre: "Tienda Uno", hashDivergenteAt: NOW, ultimoContactoOkAt: NOW }),
      stalenessRow({ negocioId: "A", tiendaId: "t3", nombre: "Tienda Tres", hashDivergenteAt: null, ultimoContactoOkAt: NOW }),
    ];

    const result = aggregateQabBusinessAlertState({ rows, now: NOW });

    expect(result[0].divergedTiendaIds).toEqual(["t1", "t2"]);
    expect(result[0].divergedNombres).toEqual(["Tienda Uno", "Tienda Dos"]);
  });
});

function alertState(overrides: Partial<IQabBusinessAlertState> = {}): IQabBusinessAlertState {
  return {
    negocioId: "n1",
    ultimoContactoAt: new Date("2026-01-01T00:00:00.000Z"),
    stale: false,
    divergedTiendaIds: [],
    divergedNombres: [],
    ...overrides,
  };
}

const STALE_MINUTES = QAB_SYNC_STALE_THRESHOLD_MS / 60_000;

describe("planQabAlertNotifications", () => {
  it("stalled is non-null exactly when the state is stale, with the exact contract copy", () => {
    const plan = planQabAlertNotifications({ state: alertState({ stale: true }), now: NOW });

    expect(plan.stalled).not.toBeNull();
    expect(plan.stalled?.titulo).toBe(QAB_ALERT_TITLES.syncStalled);
    expect(plan.stalled?.nivelImportancia).toBe("ALTA");
    expect(plan.stalled?.tipo).toBe("ALERTA");
    expect(plan.stalled?.descripcion).toBe(
      `La sincronización con la tienda online lleva más de ${STALE_MINUTES} minutos sin una corrida exitosa. Los precios y la disponibilidad que ve el comprador pueden estar desactualizados.`
    );
  });

  it("stalled is null when the state is not stale", () => {
    const plan = planQabAlertNotifications({ state: alertState({ stale: false }), now: NOW });
    expect(plan.stalled).toBeNull();
  });

  it("diverged is non-null exactly when divergedTiendaIds is non-empty, with the exact contract copy joining names by \", \"", () => {
    const plan = planQabAlertNotifications({
      state: alertState({ divergedTiendaIds: ["t1", "t2"], divergedNombres: ["Tienda Uno", "Tienda Dos"] }),
      now: NOW,
    });

    expect(plan.diverged).not.toBeNull();
    expect(plan.diverged?.titulo).toBe(QAB_ALERT_TITLES.hashDiverged);
    expect(plan.diverged?.descripcion).toBe(
      "El catálogo publicado no coincide con el de la tienda online en: Tienda Uno, Tienda Dos. Sus productos quedaron marcados para reenviarse en la próxima sincronización."
    );
  });

  it("diverged is null when there are no diverged stores", () => {
    const plan = planQabAlertNotifications({ state: alertState({ divergedTiendaIds: [] }), now: NOW });
    expect(plan.diverged).toBeNull();
  });

  it("is stable across two different `now` values — the descripcion never carries elapsed time or a timestamp", () => {
    const state = alertState({ stale: true, divergedTiendaIds: ["t1"], divergedNombres: ["Tienda Uno"] });

    const planA = planQabAlertNotifications({ state, now: new Date("2026-01-01T00:00:00.000Z") });
    const planB = planQabAlertNotifications({ state, now: new Date("2026-06-01T00:00:00.000Z") });

    expect(planA.stalled?.descripcion).toBe(planB.stalled?.descripcion);
    expect(planA.diverged?.descripcion).toBe(planB.diverged?.descripcion);
  });

  it("negociosDestino is EXACTLY the state's negocioId (never omitted, never empty) and usuariosDestino is empty, on both descriptors", () => {
    const plan = planQabAlertNotifications({
      state: alertState({ negocioId: "n42", stale: true, divergedTiendaIds: ["t1"], divergedNombres: ["Tienda Uno"] }),
      now: NOW,
    });

    expect(plan.stalled?.negociosDestino).toBe("n42");
    expect(plan.diverged?.negociosDestino).toBe("n42");
    expect(plan.stalled?.usuariosDestino).toBe("");
    expect(plan.diverged?.usuariosDestino).toBe("");
  });

  it("fechaInicio is `now` and fechaFin is `now` plus QAB_ALERT_NOTIFICATION_TTL_DAYS days — a safety cap, not a real expiry", () => {
    const plan = planQabAlertNotifications({ state: alertState({ stale: true }), now: NOW });
    const expectedFin = new Date(NOW.getTime() + QAB_ALERT_NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);

    expect(plan.stalled?.fechaInicio).toEqual(NOW);
    expect(plan.stalled?.fechaFin).toEqual(expectedFin);
  });
});
