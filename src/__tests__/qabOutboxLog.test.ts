import { describe, it, expect, vi, afterEach } from "vitest";
import {
  logQabPermanentFailure,
  logQabSlugLearnOutcome,
  logQabExchangeRateCancel,
  logQabOutboxDeferral,
} from "@/lib/qab/qabOutboxLog";
import type {
  IQabPermanentFailure,
  IQabSlugLearnResult,
  IQabOutboxDeferral,
} from "@/schemas/qabSync";
import {
  QAB_SLUG_LEARN_LOG,
  QAB_SLUG_LEARN_OUTCOMES,
  QAB_OUTBOX_CANCEL_LOG,
  QAB_EXCHANGE_RATE_ENTITY,
  QAB_OUTBOX_DEFERRED_LOG,
  QAB_OUTBOX_DEFERRED_ERROR_CODES,
} from "@/constants/qab";

/**
 * F-005 — `src/lib/qab/qabOutboxLog.ts` (contract §5.5). One console.error line per permanent
 * failure, carrying only ids and the error code — never the store name, never the payload,
 * following the same redaction rule as `logRouteError`.
 */

const failure: IQabPermanentFailure = {
  eventId: "42",
  negocioId: "negocio-1",
  entidad: "STORE",
  entidadId: "tienda-1",
  code: "STORE_OPENING_HOURS_INVALID",
};

describe("logQabPermanentFailure", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should write exactly one line via console.error in the documented format", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabPermanentFailure(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "QAB_PERMANENT_FAILURE entidad=STORE entidadId=tienda-1 negocioId=negocio-1 code=STORE_OPENING_HOURS_INVALID eventId=42"
    );
  });

  it("should never call console.log or console.warn", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logQabPermanentFailure(failure);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(logQabPermanentFailure(failure)).toBeUndefined();
  });

  it("should not leak a store name or a payload smuggled onto the arguments object", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const smuggled = {
      ...failure,
      storeName: "Bodega Secreta",
      payload: { phone: "+5350000000" },
    } as unknown as IQabPermanentFailure;

    logQabPermanentFailure(smuggled);

    const loggedArgs = errorSpy.mock.calls.flat();
    expect(loggedArgs.some((arg) => String(arg).includes("Bodega Secreta"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("+5350000000"))).toBe(false);
  });
});

/**
 * F-020 — `logQabSlugLearnOutcome` (contract §6.4). One line per learning target, ids and the
 * closed code only — no `reason`, no `url`, no response body, no slug. `tenant_mismatch` is the
 * one outcome that goes to `console.error`; every other outcome goes to `console.info`.
 */
describe("logQabSlugLearnOutcome", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const result: IQabSlugLearnResult = {
    negocioId: "negocio-1",
    tiendaId: "tienda-1",
    outcome: "learned",
  };

  it("should write exactly one line via console.info in the documented format for a non-tenant-mismatch outcome", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabSlugLearnOutcome(result);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      `${QAB_SLUG_LEARN_LOG} negocioId=negocio-1 tiendaId=tienda-1 outcome=learned`
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should write via console.error, NOT console.info, for outcome tenant_mismatch", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabSlugLearnOutcome({ ...result, outcome: "tenant_mismatch" });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      `${QAB_SLUG_LEARN_LOG} negocioId=negocio-1 tiendaId=tienda-1 outcome=tenant_mismatch`
    );
    expect(infoSpy).not.toHaveBeenCalled();
  });

  const nonTenantMismatchOutcomes: readonly IQabSlugLearnResult["outcome"][] =
    QAB_SLUG_LEARN_OUTCOMES.filter((outcome) => outcome !== "tenant_mismatch");

  it.each(nonTenantMismatchOutcomes)(
    "should log outcome %s via console.info",
    (outcome) => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      logQabSlugLearnOutcome({ ...result, outcome });

      expect(infoSpy).toHaveBeenCalledTimes(1);
    }
  );

  it("should never call console.log", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logQabSlugLearnOutcome(result);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should not leak anything beyond negocioId, tiendaId and outcome — no reason, no url, no slug", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const smuggled = {
      ...result,
      reason: "own",
      url: "https://queandabuscando.com/la-rampa-2",
      resolvedSlug: "la-rampa-2",
    } as unknown as IQabSlugLearnResult;

    logQabSlugLearnOutcome(smuggled);

    const loggedArgs = infoSpy.mock.calls.flat();
    expect(loggedArgs.some((arg) => String(arg).includes("la-rampa-2"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("reason="))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("url="))).toBe(false);
  });
});

/**
 * F-028 (part A) — `logQabExchangeRateCancel` (contract §4.4). One line per cancellation of
 * superseded EXCHANGE_RATE events, ids and counts only — the same redaction rule as
 * `logQabPermanentFailure`. `info` for a normal cancellation; `warn` when the read's cap
 * (`QAB_OUTBOX_CANCEL_MAX_ROWS`) was reached, same split as `logQabSlugLearnOutcome`.
 */
describe("logQabExchangeRateCancel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface ICancelLogEntry {
    negocioId: string;
    entidadId: string;
    cancelled: number;
    capReached: boolean;
  }

  const entry: ICancelLogEntry = {
    negocioId: "negocio-1",
    entidadId: "USD",
    cancelled: 1,
    capReached: false,
  };

  it("should write exactly one line via console.info in the documented format when the cap was not reached", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabExchangeRateCancel(entry);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(
      `${QAB_OUTBOX_CANCEL_LOG} entidad=${QAB_EXCHANGE_RATE_ENTITY} negocioId=negocio-1 entidadId=USD cancelled=1 capReached=false`
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should write via console.warn, NOT console.info, when capReached is true", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabExchangeRateCancel({ ...entry, cancelled: 100, capReached: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `${QAB_OUTBOX_CANCEL_LOG} entidad=${QAB_EXCHANGE_RATE_ENTITY} negocioId=negocio-1 entidadId=USD cancelled=100 capReached=true`
    );
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should route to console.warn purely by capReached, independent of the cancelled count", () => {
    // capReached is what makes an outcome "not routine" per the contract — not how many rows
    // were deleted. A cap reached with zero rows actually deleted is still not routine.
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logQabExchangeRateCancel({ ...entry, cancelled: 0, capReached: true });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(logQabExchangeRateCancel(entry)).toBeUndefined();
  });

  it("should never call console.log", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logQabExchangeRateCancel(entry);

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should not leak a payload, a business token or a QAB error body smuggled onto the entry — ids and counts only (acceptance criterion 11)", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const smuggled = {
      ...entry,
      payload: { tasa: "999.99", marker: "PAYLOAD_MARKER_XYZ" },
      qabToken: "TOKEN_MARKER_ABC",
      errorBody: "QAB_ERROR_BODY_MARKER_123",
    } as unknown as ICancelLogEntry;

    logQabExchangeRateCancel(smuggled);

    const loggedArgs = [...infoSpy.mock.calls.flat(), ...warnSpy.mock.calls.flat()];
    // Positive control (E-002/E-008): prove the harness would have seen the marker if it had
    // been logged, by checking it is present on the smuggled input itself.
    expect(JSON.stringify(smuggled)).toContain("PAYLOAD_MARKER_XYZ");
    expect(loggedArgs.some((arg) => String(arg).includes("PAYLOAD_MARKER_XYZ"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("TOKEN_MARKER_ABC"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("QAB_ERROR_BODY_MARKER_123"))).toBe(
      false
    );
    expect(loggedArgs.some((arg) => String(arg).includes("payload"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("qabToken"))).toBe(false);
  });
});

/**
 * F-028 (part B) — `logQabOutboxDeferral` (contract §6). One line per deferred event: a
 * `failed[]` entry QAB blamed on ANOTHER event of the same batch (`DEPENDENCY_FAILED_IN_BATCH`).
 * Calcado de `logQabPermanentFailure` — ids and the CLOSED code only, never a payload, never the
 * business token, never the raw QAB error body (acceptance criterion 11). `warn`, not `error` (a
 * deferral is not this event's own failure) and not `info` either (it is not routine) — ADR 0103
 * § 2 reads it the same way `logQabWithheldOutbox` reads a backlog waiting for a switch.
 */
describe("logQabOutboxDeferral", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function deferral(): IQabOutboxDeferral {
    return {
      eventId: "42",
      negocioId: "negocio-1",
      entidad: "PRODUCT",
      entidadId: "producto-1",
      code: QAB_OUTBOX_DEFERRED_ERROR_CODES[0],
    };
  }

  it("should write exactly one line via console.warn in the documented format", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logQabOutboxDeferral(deferral());

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      `${QAB_OUTBOX_DEFERRED_LOG} entidad=PRODUCT entidadId=producto-1 negocioId=negocio-1 code=${QAB_OUTBOX_DEFERRED_ERROR_CODES[0]} eventId=42`
    );
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("should never call console.log, console.info or console.error — warn only, not error (not this event's own fault) and not info (not routine)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logQabOutboxDeferral(deferral());

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("should return undefined", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(logQabOutboxDeferral(deferral())).toBeUndefined();
  });

  it("should not leak a payload, a business token or a raw QAB error body smuggled onto the entry — ids and the closed code only (acceptance criterion 11)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const smuggled = {
      ...deferral(),
      payload: { localCategoryId: "cat-1", marker: "PAYLOAD_MARKER_XYZ" },
      qabToken: "TOKEN_MARKER_ABC",
      error: "QAB_ERROR_BODY_MARKER_123", // the raw string QAB sent — IQabOutboxDeferral never carries it
    } as unknown as IQabOutboxDeferral;

    logQabOutboxDeferral(smuggled);

    const loggedArgs = warnSpy.mock.calls.flat();
    // Positive control (E-002/E-008): prove the harness would have seen the marker if it had
    // been logged, by checking it is present on the smuggled input itself.
    expect(JSON.stringify(smuggled)).toContain("PAYLOAD_MARKER_XYZ");
    expect(loggedArgs.some((arg) => String(arg).includes("PAYLOAD_MARKER_XYZ"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("TOKEN_MARKER_ABC"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("QAB_ERROR_BODY_MARKER_123"))).toBe(
      false
    );
    expect(loggedArgs.some((arg) => String(arg).includes("payload"))).toBe(false);
    expect(loggedArgs.some((arg) => String(arg).includes("qabToken"))).toBe(false);
  });
});
