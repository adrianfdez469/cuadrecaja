import { describe, it, expect } from "vitest";
import type { ITipoMovimientoCuentaPorCobrar } from "@/schemas/cuentaPorCobrar";
import { pagoLineaSchema } from "@/schemas/pago";

/**
 * F-035 — `src/lib/cuentasPorCobrar/applyMovimiento.ts` (contract § 3, § 3.1, § 4bis's
 * sibling worked table in § 5.2). Covers testability symbols 1-5.
 *
 * Written against the CONTRACT, without seeing the implementation (the `implementer`
 * runs in parallel). Dynamic top-level import, same idiom as `cuentasPorCobrarSaldo.test.ts`
 * and `tenantScope.test.ts`: the module does not exist yet, so a static import would fail
 * the whole file at collection time regardless (E-019) — this is the established idiom,
 * not a workaround that avoids red.
 */
const {
  MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS,
  MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS,
  decideMovimientoCuentaPorCobrar,
  valueAbonoPagos,
  MovimientoCuentaPorCobrarError,
} = await import("@/lib/cuentasPorCobrar/applyMovimiento");

const CUENTA_A = "cuenta-a";
const CUENTA_B = "cuenta-b-otra";
const FECHA = new Date("2026-01-15T12:00:00.000Z");

type Origen = {
  id: string;
  cuentaPorCobrarId: string;
  tipo: ITipoMovimientoCuentaPorCobrar;
  monto: number;
};

interface DecisionInputOverrides {
  cuentaId?: string;
  tipo?: ITipoMovimientoCuentaPorCobrar;
  monto?: number;
  saldoPendiente?: number;
  fecha?: Date;
  revierteId?: string | null;
  origen?: Origen | null;
  origenYaRevertido?: boolean;
}

/** A minimal, valid ABONO input — every guard test overrides only what it needs. */
function baseInput(over: DecisionInputOverrides = {}) {
  return {
    cuentaId: CUENTA_A,
    tipo: "ABONO" as ITipoMovimientoCuentaPorCobrar,
    monto: 100,
    saldoPendiente: 1000,
    fecha: FECHA,
    revierteId: null,
    origen: null,
    origenYaRevertido: false,
    ...over,
  };
}

describe("MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS — the vocabulary, in the exact order of § 3.1", () => {
  it("is exactly the eight violations, in evaluation order", () => {
    expect(MOVIMIENTO_CUENTA_POR_COBRAR_VIOLATIONS).toEqual([
      "MONTO_NO_POSITIVO",
      "REVIERTE_ID_INESPERADO",
      "REVERSION_SIN_REVIERTE_ID",
      "REVERSION_ORIGEN_INALCANZABLE",
      "REVERSION_ORIGEN_NO_ES_ABONO",
      "REVERSION_DUPLICADA",
      "REVERSION_MONTO_DISTINTO",
      "SALDO_INSUFICIENTE",
    ]);
  });
});

describe("MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS — the code of every rejection", () => {
  it("maps each violation to the documented status, and only those eight keys", () => {
    expect(MOVIMIENTO_CUENTA_POR_COBRAR_HTTP_STATUS).toEqual({
      MONTO_NO_POSITIVO: 400,
      REVIERTE_ID_INESPERADO: 400,
      REVERSION_SIN_REVIERTE_ID: 400,
      REVERSION_ORIGEN_INALCANZABLE: 404,
      REVERSION_ORIGEN_NO_ES_ABONO: 400,
      REVERSION_DUPLICADA: 409,
      REVERSION_MONTO_DISTINTO: 400,
      SALDO_INSUFICIENTE: 400,
    });
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 1: MONTO_NO_POSITIVO", () => {
  it.each([0, -1, -0.01, NaN, Infinity, -Infinity])(
    "refuses monto=%p",
    (monto) => {
      const result = decideMovimientoCuentaPorCobrar(baseInput({ monto }));
      expect(result.ok).toBe(false);
      expect(result.violation).toBe("MONTO_NO_POSITIVO");
      // Refused: the balance travels back UNCHANGED (contract § 3, IMovimientoDecision).
      expect(result.saldoPendiente).toBe(1000);
    },
  );

  it("accepts a small positive monto (0.01 is not <= 0)", () => {
    const result = decideMovimientoCuentaPorCobrar(baseInput({ monto: 0.01 }));
    expect(result.violation).toBeNull();
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 2: REVIERTE_ID_INESPERADO", () => {
  it("refuses a revierteId on a tipo that is not REVERSION_ABONO", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 100, revierteId: "algun-id" }),
    );
    expect(result.violation).toBe("REVIERTE_ID_INESPERADO");
  });

  it("does not fire when tipo IS REVERSION_ABONO (control)", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 100 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 100,
        revierteId: "m1",
        origen,
        saldoPendiente: 600,
      }),
    );
    expect(result.violation).not.toBe("REVIERTE_ID_INESPERADO");
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 3: REVERSION_SIN_REVIERTE_ID", () => {
  it("refuses a REVERSION_ABONO with no revierteId", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "REVERSION_ABONO", monto: 100, revierteId: null }),
    );
    expect(result.violation).toBe("REVERSION_SIN_REVIERTE_ID");
  });

  it("also refuses with revierteId undefined", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "REVERSION_ABONO", monto: 100, revierteId: undefined }),
    );
    expect(result.violation).toBe("REVERSION_SIN_REVIERTE_ID");
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 4: REVERSION_ORIGEN_INALCANZABLE", () => {
  it("refuses when origen is null", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "REVERSION_ABONO", monto: 400, revierteId: "m1", origen: null }),
    );
    expect(result.violation).toBe("REVERSION_ORIGEN_INALCANZABLE");
  });

  it("refuses when origen belongs to ANOTHER account — worked table row 13", () => {
    const origenDeOtraCuenta: Origen = {
      id: "m1",
      cuentaPorCobrarId: CUENTA_B,
      tipo: "ABONO",
      monto: 400,
    };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        cuentaId: CUENTA_A,
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen: origenDeOtraCuenta,
        saldoPendiente: 600,
      }),
    );
    expect(result.violation).toBe("REVERSION_ORIGEN_INALCANZABLE");
    expect(result.saldoPendiente).toBe(600); // unchanged
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 5: REVERSION_ORIGEN_NO_ES_ABONO", () => {
  it("refuses when the origin row is not an ABONO", () => {
    const origenNoAbono: Origen = {
      id: "m1",
      cuentaPorCobrarId: CUENTA_A,
      tipo: "CONDONACION",
      monto: 400,
    };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen: origenNoAbono,
        saldoPendiente: 600,
      }),
    );
    expect(result.violation).toBe("REVERSION_ORIGEN_NO_ES_ABONO");
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 6: REVERSION_DUPLICADA", () => {
  it("refuses reverting an ABONO that was already reverted — worked table row 14", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 400 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen,
        origenYaRevertido: true,
        saldoPendiente: 1000,
      }),
    );
    expect(result.violation).toBe("REVERSION_DUPLICADA");
    expect(result.saldoPendiente).toBe(1000); // unchanged
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 7: REVERSION_MONTO_DISTINTO", () => {
  it("refuses when the reversal's monto does not match the origin's monto", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 400 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 350,
        revierteId: "m1",
        origen,
        saldoPendiente: 600,
      }),
    );
    expect(result.violation).toBe("REVERSION_MONTO_DISTINTO");
  });

  it("accepts when it matches to the cent (round2 comparison)", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 400 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 400.001,
        revierteId: "m1",
        origen,
        saldoPendiente: 600,
      }),
    );
    expect(result.violation).not.toBe("REVERSION_MONTO_DISTINTO");
  });
});

describe("decideMovimientoCuentaPorCobrar — guard 8: SALDO_INSUFICIENTE", () => {
  it("refuses an amount above the balance — worked table row 6, body carries the REAL balance (500)", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 700, saldoPendiente: 500 }),
    );
    expect(result.violation).toBe("SALDO_INSUFICIENTE");
    expect(result.saldoPendiente).toBe(500); // unchanged — this is what criterion 9 measures
  });

  it("accepts an amount EQUAL to the balance — the limit is accepted, worked table row 7", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 500, saldoPendiente: 500 }),
    );
    expect(result.ok).toBe(true);
    expect(result.violation).toBeNull();
    expect(result.saldoPendiente).toBe(0);
    expect(result.settledAt).toEqual(FECHA);
  });

  it("does NOT apply to REVERSION_ABONO — its sign is +1, so no amount is ever 'too much'", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 600 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 600,
        revierteId: "m1",
        origen,
        saldoPendiente: 0,
      }),
    );
    expect(result.violation).not.toBe("SALDO_INSUFICIENTE");
    expect(result.ok).toBe(true);
  });

  it("a losing concurrent request sees the balance the winner left — worked table row 8 (300, not 1000)", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 700, saldoPendiente: 300 }),
    );
    expect(result.violation).toBe("SALDO_INSUFICIENTE");
    expect(result.saldoPendiente).toBe(300);
  });
});

describe("decideMovimientoCuentaPorCobrar — ORDER of the guards is the contract (§ 3.1), not just each guard alone", () => {
  it("guard 1 wins over guard 2: a non-positive monto with an unexpected revierteId is MONTO_NO_POSITIVO", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: -5, revierteId: "unexpected" }),
    );
    expect(result.violation).toBe("MONTO_NO_POSITIVO");
  });

  it("guard 1 wins over guard 3: a REVERSION_ABONO with monto 0 and no revierteId is MONTO_NO_POSITIVO", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "REVERSION_ABONO", monto: 0, revierteId: null }),
    );
    expect(result.violation).toBe("MONTO_NO_POSITIVO");
  });

  it("guard 3 wins over guard 4: no revierteId AND origen null is REVERSION_SIN_REVIERTE_ID, not REVERSION_ORIGEN_INALCANZABLE", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "REVERSION_ABONO", monto: 400, revierteId: null, origen: null }),
    );
    expect(result.violation).toBe("REVERSION_SIN_REVIERTE_ID");
  });

  it("guard 4 wins over guard 5: origin unreachable AND (if it were reached) not an ABONO is still REVERSION_ORIGEN_INALCANZABLE", () => {
    const origenAjenoYNoAbono: Origen = {
      id: "m1",
      cuentaPorCobrarId: CUENTA_B, // wrong account
      tipo: "CONDONACION", // AND wrong type
      monto: 400,
    };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        cuentaId: CUENTA_A,
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen: origenAjenoYNoAbono,
      }),
    );
    expect(result.violation).toBe("REVERSION_ORIGEN_INALCANZABLE");
  });

  it("guard 5 wins over guard 6: origin not an ABONO AND already reverted is still REVERSION_ORIGEN_NO_ES_ABONO", () => {
    const origenNoAbono: Origen = {
      id: "m1",
      cuentaPorCobrarId: CUENTA_A,
      tipo: "CONDONACION",
      monto: 400,
    };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen: origenNoAbono,
        origenYaRevertido: true,
      }),
    );
    expect(result.violation).toBe("REVERSION_ORIGEN_NO_ES_ABONO");
  });

  it("guard 6 wins over guard 7: already reverted AND a mismatched monto is still REVERSION_DUPLICADA", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 400 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 999, // does not match origen.monto
        revierteId: "m1",
        origen,
        origenYaRevertido: true,
      }),
    );
    expect(result.violation).toBe("REVERSION_DUPLICADA");
  });
});

describe("decideMovimientoCuentaPorCobrar — settledAt is RECOMPUTED, set AND lifted back", () => {
  it("sets settledAt when the balance lands at exactly MIN_OPEN_BALANCE_BASE or below — worked table row 5", () => {
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 600, saldoPendiente: 600 }),
    );
    expect(result.saldoPendiente).toBe(0);
    expect(result.settledAt).toEqual(FECHA);
  });

  it("a REVERSION_ABONO on a SETTLED account lifts it back to null — worked table row 12", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 600 };
    const result = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 600,
        revierteId: "m1",
        origen,
        saldoPendiente: 0,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.saldoPendiente).toBe(600);
    expect(result.settledAt).toBeNull(); // the account is LIVE again, not still "settled"
  });
});

describe("decideMovimientoCuentaPorCobrar — the worked table of contract § 5.2, reproduced case by case", () => {
  it("ABONO 400 on saldo 1000 -> 600, open", () => {
    const r = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 400, saldoPendiente: 1000 }),
    );
    expect(r.ok).toBe(true);
    expect(r.saldoPendiente).toBe(600);
    expect(r.settledAt).toBeNull();
  });

  it("ABONO 300 on saldo 1000 -> 700, open (row used for the idempotency scenario at the route level)", () => {
    const r = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "ABONO", monto: 300, saldoPendiente: 1000 }),
    );
    expect(r.saldoPendiente).toBe(700);
  });

  it("CONDONACION with monto == saldoPendiente (500) settles the account — worked table row 9", () => {
    const r = decideMovimientoCuentaPorCobrar(
      baseInput({ tipo: "CONDONACION", monto: 500, saldoPendiente: 500 }),
    );
    expect(r.ok).toBe(true);
    expect(r.saldoPendiente).toBe(0);
    expect(r.settledAt).toEqual(FECHA);
  });

  it("REVERSION_ABONO of 400 on saldo 600 -> 1000, open — worked table row 11", () => {
    const origen: Origen = { id: "m1", cuentaPorCobrarId: CUENTA_A, tipo: "ABONO", monto: 400 };
    const r = decideMovimientoCuentaPorCobrar(
      baseInput({
        tipo: "REVERSION_ABONO",
        monto: 400,
        revierteId: "m1",
        origen,
        saldoPendiente: 600,
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.saldoPendiente).toBe(1000);
    expect(r.settledAt).toBeNull();
  });
});

describe("valueAbonoPagos — criterion 5, the multicurrency conversion of a collection", () => {
  it("100 USD at 120, monedaBase CUP -> montoBase EXACTLY 12000 (a debt of 12000 is settled to the cent)", () => {
    const result = valueAbonoPagos({
      pagos: [{ tipo: "cash", moneda: "USD", monto: 100 }],
      tasas: { USD: 120 },
      monedaBase: "CUP",
    });
    expect(result.montoBase).toBe(12000);
    expect(result.pagosDetalle).toHaveLength(1);
    expect(result.pagosDetalle[0].equivalenteBase).toBe(12000);
    expect(result.pagosDetalle[0].moneda).toBe("USD");
    expect(result.pagosDetalle[0].monto).toBe(100);
  });

  it("a SECOND, non-exact case (50 USD at 120 -> 6000) so the first is not a rounding coincidence", () => {
    const result = valueAbonoPagos({
      pagos: [{ tipo: "cash", moneda: "USD", monto: 50 }],
      tasas: { USD: 120 },
      monedaBase: "CUP",
    });
    expect(result.montoBase).toBe(6000);
    expect(result.pagosDetalle[0].equivalenteBase).toBe(6000);
  });

  it("sums multiple lines across monedas and payment types — the § 4bis worked example (100 USD cash + 500 CUP transfer -> 12500)", () => {
    const transferDestinationId = crypto.randomUUID();
    const result = valueAbonoPagos({
      pagos: [
        { tipo: "cash", moneda: "USD", monto: 100 },
        { tipo: "transfer", moneda: "CUP", monto: 500, transferDestinationId },
      ],
      tasas: { USD: 120 },
      monedaBase: "CUP",
    });
    expect(result.montoBase).toBe(12500);
    const cashLine = result.pagosDetalle.find((l) => l.tipo === "cash")!;
    const transferLine = result.pagosDetalle.find((l) => l.tipo === "transfer")!;
    expect(cashLine.equivalenteBase).toBe(12000);
    expect(transferLine.equivalenteBase).toBe(500);
    expect(transferLine.transferDestinationId).toBe(transferDestinationId);
  });

  it("a line paid directly in the moneda base has equivalenteBase equal to its own monto", () => {
    const result = valueAbonoPagos({
      pagos: [{ tipo: "cash", moneda: "CUP", monto: 300 }],
      tasas: {},
      monedaBase: "CUP",
    });
    expect(result.montoBase).toBe(300);
    expect(result.pagosDetalle[0].equivalenteBase).toBe(300);
  });

  it("every returned line satisfies pagoLineaSchema (F-031) — equivalenteBase is nonnegative and monto positive", () => {
    const result = valueAbonoPagos({
      pagos: [{ tipo: "cash", moneda: "USD", monto: 100 }],
      tasas: { USD: 120 },
      monedaBase: "CUP",
    });
    expect(pagoLineaSchema.safeParse(result.pagosDetalle[0]).success).toBe(true);
  });

  it("rounds montoBase to two decimals (floating-point noise does not leak through)", () => {
    const result = valueAbonoPagos({
      pagos: [
        { tipo: "cash", moneda: "USD", monto: 0.1 },
        { tipo: "cash", moneda: "USD", monto: 0.2 },
      ],
      tasas: { USD: 1 },
      monedaBase: "CUP",
    });
    expect(result.montoBase).toBe(0.3);
  });
});

describe("MovimientoCuentaPorCobrarError — extends Error (§ 3)", () => {
  // The contract fixes the two fields (`violation`, `saldoPendiente`) but NOT the
  // constructor's parameter order, and this class is thrown only by the impure write
  // door (`applyMovimientoCuentaPorCobrar`, which needs a Prisma tx and is out of this
  // suite's scope — it is verified by the `qa` executing the routes). Guessing a
  // constructor signature the contract does not fix would risk a false failure on a
  // correct implementation (dev-tester must not test against a guessed shape). Only
  // the one thing the contract DOES fix — that it is an Error subclass — is asserted
  // here; see the report for what is left to QA.
  it("is a subclass of Error", () => {
    expect(MovimientoCuentaPorCobrarError.prototype instanceof Error).toBe(true);
  });
});
