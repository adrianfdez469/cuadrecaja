import { describe, it, expect, vi, afterEach } from "vitest";
import { logQabPermanentFailure, logQabSlugLearnOutcome } from "@/lib/qab/qabOutboxLog";
import type { IQabPermanentFailure, IQabSlugLearnResult } from "@/schemas/qabSync";
import { QAB_SLUG_LEARN_LOG, QAB_SLUG_LEARN_OUTCOMES } from "@/constants/qab";

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
