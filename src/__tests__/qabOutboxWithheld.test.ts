import { describe, it, expect } from "vitest";
import {
  QAB_BUSINESS_ENTITY,
  QAB_OUTBOX_ENTITIES,
  QAB_OUTBOX_WITHHELD_ENTITIES,
  QAB_OUTBOX_DRAINABLE_ENTITIES,
} from "@/constants/qab";
import { outboxEventoCreateSchema } from "@/schemas/qabOutbox";
import { emptyQabOutboxDrainReport } from "@/lib/qab/outboxAck";

/**
 * F-027 — the withheld-entity mechanism of the outbox drain (contract § 1, § 7,
 * ADR 0092 § 1). This is § 10.1 of the contract's testability list: pure, no
 * database, no network.
 *
 * NOT covered here, on purpose (contract § 10.2 — needs a database, verified by
 * `qa`, not fabricated with a Prisma mock):
 *  - that `claimOutboxBatch` actually excludes a BUSINESS row from a claim while
 *    still claiming a PRODUCT row of the same business,
 *  - that `withheld`/the log line appear on a run whose claim came back empty,
 *  - `readQabWithheldOutboxPending` itself (it is a read).
 *
 * On purpose too: no test here pins `QAB_OUTBOX_WITHHELD_ENTITIES` to contain
 * "BUSINESS". The contract (§ 1, § 7.2) and ADR 0092 § 1 both say turning the
 * switch on is emptying that array — a test that hardcodes its content today
 * would go red on the day the switch is flipped, which is the opposite of what
 * this suite should protect.
 */

describe("outboxEventoCreateSchema — accepts entidad: QAB_BUSINESS_ENTITY", () => {
  it("is the cheapest test of this feature and the one whose absence would fail everything else silently: without \"BUSINESS\" in QAB_OUTBOX_ENTITIES, enqueueOutboxEvents throws a ZodError INSIDE the caller's transaction and the whole mutation reverts", () => {
    const parsed = outboxEventoCreateSchema.safeParse({
      negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
      entidad: QAB_BUSINESS_ENTITY,
      entidadId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
      operacion: "UPDATE",
      payload: {
        businessId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
        displayCurrencies: ["CUP"],
        updatedAt: "2026-09-06T14:03:00.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });
});

// NOT tested here, on purpose: "a BUSINESS event is never emitted with
// operacion DELETE" (contract § 5) is a caller discipline — `emitQabBusinessDisplayCurrencies`
// always passes `operacion: "UPDATE"` — and not a schema-level constraint:
// `outboxEventoCreateSchema` structurally allows DELETE for every entity alike,
// so a test asserting rejection here would fail against a correct schema and
// prove nothing about the emitter's behavior.

describe("QAB_OUTBOX_DRAINABLE_ENTITIES — the derivation invariant that survives turning BUSINESS back on", () => {
  it("should contain no entity that is in QAB_OUTBOX_WITHHELD_ENTITIES", () => {
    for (const entity of QAB_OUTBOX_WITHHELD_ENTITIES) {
      expect(QAB_OUTBOX_DRAINABLE_ENTITIES).not.toContain(entity);
    }
  });

  it("should contain every entity of QAB_OUTBOX_ENTITIES that is NOT withheld", () => {
    const withheld = new Set<string>(QAB_OUTBOX_WITHHELD_ENTITIES);
    for (const entity of QAB_OUTBOX_ENTITIES) {
      if (!withheld.has(entity)) {
        expect(QAB_OUTBOX_DRAINABLE_ENTITIES).toContain(entity);
      }
    }
  });

  it("should never be empty — an empty allow-list would make the claim's SQL IN () invalid", () => {
    expect(QAB_OUTBOX_DRAINABLE_ENTITIES.length).toBeGreaterThan(0);
  });

  it("should partition QAB_OUTBOX_ENTITIES exactly with QAB_OUTBOX_WITHHELD_ENTITIES: disjoint and covering, with no leftover and no double-count", () => {
    expect(QAB_OUTBOX_DRAINABLE_ENTITIES.length + QAB_OUTBOX_WITHHELD_ENTITIES.length).toBe(
      QAB_OUTBOX_ENTITIES.length
    );
  });
});

describe("emptyQabOutboxDrainReport()", () => {
  it("should return withheld: []", () => {
    const report = emptyQabOutboxDrainReport();

    expect(report.withheld).toEqual([]);
  });
});
