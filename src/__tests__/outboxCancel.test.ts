import { describe, it, expect } from "vitest";
import {
  isSupersededExchangeRateEvent,
  selectSupersededExchangeRateEventIds,
} from "@/lib/qab/outboxCancel";
import type {
  IQabOutboxCancelCandidate,
  IQabExchangeRateCancelTarget,
} from "@/lib/qab/outboxCancel";
import { QAB_EXCHANGE_RATE_ENTITY, QAB_CURRENCY_ENTITY } from "@/constants/qab";

/**
 * F-028 (part A) — `src/lib/qab/outboxCancel.ts` (contract §4.2). Covers the two pure symbols
 * row by row against the edge-case table fixed by the contract. Written against the interface
 * contract, not the implementation — the implementer runs in parallel and is not read here.
 *
 * `cancelSupersededExchangeRateEvents` (the impure function) needs Postgres and is NOT tested
 * here (contract §8.2): verifying it means executing the acceptance criteria, which is QA's job.
 */

const target: IQabExchangeRateCancelTarget = { negocioId: "negocio-1", code: "USD" };

describe("isSupersededExchangeRateEvent", () => {
  it("should return true when negocioId, entidad and entidadId all match and procesadoAt is null (the central case)", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "501",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(true);
  });

  it("should return false when procesadoAt is a Date — the row was already acknowledged ok (acceptance criterion 4)", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "502",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should return false when negocioId differs but entidad/entidadId/procesadoAt all match — tenant isolation, half of acceptance criterion 3", () => {
    // Shares the SAME code ("USD") as `target` on purpose (E-008): a filter that dropped
    // negocioId from its comparison would still, wrongly, call this a match.
    const candidate: IQabOutboxCancelCandidate = {
      id: "503",
      negocioId: "negocio-2",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should return false when entidadId differs but negocioId/entidad/procesadoAt all match — currency isolation, the other half of acceptance criterion 3", () => {
    // Shares the SAME negocioId as `target` on purpose (E-008): a filter that dropped entidadId
    // from its comparison would still, wrongly, call this a match.
    const candidate: IQabOutboxCancelCandidate = {
      id: "504",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "EUR",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should return false when entidad is CURRENCY instead of EXCHANGE_RATE, even with matching negocioId/entidadId/procesadoAt", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "505",
      negocioId: "negocio-1",
      entidad: QAB_CURRENCY_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should ignore intentos even when smuggled onto the candidate — the function's signature never receives that column", () => {
    const candidateWithIntentos = {
      id: "506",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
      intentos: 999,
    } as unknown as IQabOutboxCancelCandidate;

    expect(isSupersededExchangeRateEvent(candidateWithIntentos, target)).toBe(true);
  });

  // Beyond the table, but pinned by the docstring text of contract §4.2: "strict equality on
  // all three strings, case sensitive, with no trimming and no normalisation".
  it("should be case-sensitive when comparing entidadId (no normalisation)", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "507",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "usd",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should not trim entidadId before comparing (no normalisation)", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "508",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: " USD",
      procesadoAt: null,
    };

    expect(isSupersededExchangeRateEvent(candidate, target)).toBe(false);
  });

  it("should never throw for a candidate that matches nothing", () => {
    const candidate: IQabOutboxCancelCandidate = {
      id: "509",
      negocioId: "some-other-negocio",
      entidad: QAB_CURRENCY_ENTITY,
      entidadId: "GBP",
      procesadoAt: new Date("2020-01-01T00:00:00.000Z"),
    };

    expect(() => isSupersededExchangeRateEvent(candidate, target)).not.toThrow();
  });
});

describe("selectSupersededExchangeRateEventIds", () => {
  it("should return an empty array for an empty candidate list", () => {
    expect(selectSupersededExchangeRateEventIds([], target)).toEqual([]);
  });

  it("should isolate by negocioId AND by entidadId across four (negocio, moneda) combinations, leaving exactly the one match — acceptance criterion 3", () => {
    // Two negocios x two monedas, sharing literal values across the axis NOT under test in
    // each row (E-008 / adenda F-021): N1 and N2 share the "USD" code, and N1 carries both
    // currencies. That is what makes each isolation half provable — a filter with either
    // negocioId or entidadId broken would flip one of the three non-matching rows to "true".
    const n1m1: IQabOutboxCancelCandidate = {
      id: "601",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };
    const n1m2: IQabOutboxCancelCandidate = {
      id: "602",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "EUR",
      procesadoAt: null,
    };
    const n2m1: IQabOutboxCancelCandidate = {
      id: "603",
      negocioId: "negocio-2",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };
    const n2m2: IQabOutboxCancelCandidate = {
      id: "604",
      negocioId: "negocio-2",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "EUR",
      procesadoAt: null,
    };

    const result = selectSupersededExchangeRateEventIds([n1m1, n1m2, n2m1, n2m2], target);

    expect(result).toEqual(["601"]);
  });

  it("should exclude an already-acknowledged row (procesadoAt set) even when negocioId/entidad/entidadId all match — acceptance criterion 4", () => {
    const acknowledged: IQabOutboxCancelCandidate = {
      id: "700",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: new Date("2026-02-02T10:00:00.000Z"),
    };
    const pending: IQabOutboxCancelCandidate = {
      id: "701",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };

    const result = selectSupersededExchangeRateEventIds([acknowledged, pending], target);

    expect(result).toEqual(["701"]);
  });

  it("should return matching ids in the order the candidates were given, not sorted, when more than one matches", () => {
    // Ids chosen so that input order and lexical/numeric order disagree: if the
    // implementation sorted (by id or otherwise) this would come back ["100", "999"] instead.
    const later: IQabOutboxCancelCandidate = {
      id: "999",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };
    const nonMatching: IQabOutboxCancelCandidate = {
      id: "500",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "EUR",
      procesadoAt: null,
    };
    const earlier: IQabOutboxCancelCandidate = {
      id: "100",
      negocioId: "negocio-1",
      entidad: QAB_EXCHANGE_RATE_ENTITY,
      entidadId: "USD",
      procesadoAt: null,
    };

    const result = selectSupersededExchangeRateEventIds([later, nonMatching, earlier], target);

    expect(result).toEqual(["999", "100"]);
  });

  it("should never throw for a list where nothing matches", () => {
    const candidates: IQabOutboxCancelCandidate[] = [
      {
        id: "800",
        negocioId: "negocio-9",
        entidad: QAB_CURRENCY_ENTITY,
        entidadId: "GBP",
        procesadoAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    ];

    expect(() => selectSupersededExchangeRateEventIds(candidates, target)).not.toThrow();
    expect(selectSupersededExchangeRateEventIds(candidates, target)).toEqual([]);
  });
});
