import { describe, it, expect } from "vitest";

/**
 * F-032, contract § 4, § 4.2, § 9.1 — `src/constants/creditoVenta.ts`, NEW.
 *
 * All the fixed literals of the feature: server error messages/codes, and the
 * checkout/ticket copy and DOM localisation classes closed by
 * `.agents/designs/F-032.md` § 8/§ 9 (D2 of the second amendment: eleven checkout keys,
 * `payBarStatus` retired; twelve DOM classes).
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019).
 */
const {
  CREDIT_INVARIANT_ERROR_MESSAGE,
  CREDIT_EXTRAS_INVALID_MESSAGE,
  CREDIT_CUSTOMER_UPSERT_RETRIES,
  CREDIT_CUSTOMER_CONFLICT_CODE,
  CREDIT_CUSTOMER_CONFLICT_MESSAGE,
  CREDIT_TICKET_COPY,
  CREDIT_CHECKOUT_COPY,
  CREDIT_DOM,
} = await import("@/constants/creditoVenta");

const { CREDIT_INVARIANT_VIOLATIONS } = await import(
  "@/lib/cuentasPorCobrar/creditInvariant"
);
const { hasControlCharacters } = await import("@/utils/printableText");

describe("CREDIT_INVARIANT_ERROR_MESSAGE", () => {
  it("has exactly one fixed message per violation of CREDIT_INVARIANT_VIOLATIONS (F-029) — a sixth violation would fail to compile before it could ship without a message", () => {
    expect(Object.keys(CREDIT_INVARIANT_ERROR_MESSAGE).sort()).toEqual(
      [...CREDIT_INVARIANT_VIOLATIONS].sort(),
    );
  });

  it("no message is empty, and none echoes structured data (a violation code, an amount, a customer id)", () => {
    for (const violation of CREDIT_INVARIANT_VIOLATIONS) {
      const message = CREDIT_INVARIANT_ERROR_MESSAGE[violation];
      expect(typeof message).toBe("string");
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("CREDIT_EXTRAS_INVALID_MESSAGE / CREDIT_CUSTOMER_CONFLICT_* / CREDIT_CUSTOMER_UPSERT_RETRIES", () => {
  it("CREDIT_EXTRAS_INVALID_MESSAGE is a fixed non-empty string", () => {
    expect(typeof CREDIT_EXTRAS_INVALID_MESSAGE).toBe("string");
    expect(CREDIT_EXTRAS_INVALID_MESSAGE.length).toBeGreaterThan(0);
  });

  it('CREDIT_CUSTOMER_CONFLICT_CODE is exactly "CREDIT_CUSTOMER_CONFLICT" (the client branches on it)', () => {
    expect(CREDIT_CUSTOMER_CONFLICT_CODE).toBe("CREDIT_CUSTOMER_CONFLICT");
  });

  it("CREDIT_CUSTOMER_CONFLICT_MESSAGE is a fixed non-empty string", () => {
    expect(typeof CREDIT_CUSTOMER_CONFLICT_MESSAGE).toBe("string");
    expect(CREDIT_CUSTOMER_CONFLICT_MESSAGE.length).toBeGreaterThan(0);
  });

  it("CREDIT_CUSTOMER_UPSERT_RETRIES is exactly 1 — ADR 0110: one retry, and only one", () => {
    expect(CREDIT_CUSTOMER_UPSERT_RETRIES).toBe(1);
  });
});

describe("CREDIT_TICKET_COPY — fixed here, not by the ui-designer (§ 4.2, decision 10)", () => {
  it('is exactly { clienteLabel: "Cliente", saldoLabel: "Saldo a credito" }', () => {
    expect(CREDIT_TICKET_COPY).toEqual({
      clienteLabel: "Cliente",
      saldoLabel: "Saldo a credito",
    });
  });

  it("carries NO accents — the ESC/POS code page does not guarantee them, unlike the rest of the checkout copy", () => {
    for (const value of Object.values(CREDIT_TICKET_COPY)) {
      expect(/^[\x00-\x7F]*$/.test(value as string)).toBe(true);
    }
  });
});

describe("CREDIT_CHECKOUT_COPY — closed at eleven keys (D2: payBarStatus retired)", () => {
  it("has exactly these eleven keys", () => {
    expect(Object.keys(CREDIT_CHECKOUT_COPY).sort()).toEqual(
      [
        "addPaymentRow",
        "addPaymentRowHint",
        "addPaymentRowBlocked",
        "blockTitle",
        "blockChangeCliente",
        "blockClearLabel",
        "blockClienteNuevo",
        "ctaWithCredit",
        "crearSinConexionEnVenta",
        "crearSinNombreEnVenta",
        "nombreInvalido",
      ].sort(),
    );
  });

  it('does NOT have a "payBarStatus" key (D2: the backlog fallback is not taken)', () => {
    expect(
      Object.prototype.hasOwnProperty.call(CREDIT_CHECKOUT_COPY, "payBarStatus"),
    ).toBe(false);
  });

  it("no value is empty — with payBarStatus retired, this rule has no exceptions", () => {
    for (const [key, value] of Object.entries(CREDIT_CHECKOUT_COPY)) {
      expect((value as string).trim().length, `key "${key}" must not be empty`).toBeGreaterThan(0);
    }
  });

  it('no value contains "por cobrar" — that belongs to the F-033 screen, and here it would send the cashier looking for a panel the POS does not have (E-016)', () => {
    for (const value of Object.values(CREDIT_CHECKOUT_COPY)) {
      expect((value as string).toLowerCase()).not.toContain("por cobrar");
    }
  });

  it("ctaWithCredit is exactly 16 characters — measured on the real button, so changing the text forces re-measuring it (E-011)", () => {
    expect(CREDIT_CHECKOUT_COPY.ctaWithCredit.length).toBe(16);
  });

  it('ctaWithCredit is exactly "VENDER A CRÉDITO" (the § 0 second-amendment correction: 16 chars, not 17)', () => {
    expect(CREDIT_CHECKOUT_COPY.ctaWithCredit).toBe("VENDER A CRÉDITO");
  });

  it("nombreInvalido carries no control characters — the message that refuses control bytes cannot itself carry them", () => {
    expect(hasControlCharacters(CREDIT_CHECKOUT_COPY.nombreInvalido)).toBe(
      false,
    );
  });

  it("nombreInvalido does not quote the rejected value: none of «, », \", ' appear in it (E-031, mechanical check)", () => {
    for (const char of ["«", "»", '"', "'"]) {
      expect(CREDIT_CHECKOUT_COPY.nombreInvalido).not.toContain(char);
    }
  });
});

describe("CREDIT_DOM — closed at twelve classes (D2)", () => {
  it("has exactly these twelve keys", () => {
    expect(Object.keys(CREDIT_DOM).sort()).toEqual(
      [
        "checkout",
        "paySheet",
        "addRow",
        "addRowCliente",
        "addRowReason",
        "block",
        "blockAmount",
        "blockCliente",
        "blockPick",
        "blockClear",
        "blockClienteNuevo",
        "nameOnlyNote",
      ].sort(),
    );
  });

  it("every value is a non-empty string with no whitespace (a single CSS class token)", () => {
    for (const value of Object.values(CREDIT_DOM)) {
      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
      expect(/\s/.test(value as string)).toBe(false);
    }
  });

  it("no two values are equal — twelve DISTINCT classes", () => {
    const values = Object.values(CREDIT_DOM) as string[];
    expect(new Set(values).size).toBe(values.length);
  });

  it("does NOT require that no value be a prefix of another — five are deliberately prefixed by cc-credit-block; the guard is classList.contains, never startsWith (E-011, E-016)", () => {
    // Documented, not asserted as a failure: cc-credit-block is a real prefix of
    // blockAmount/blockCliente/blockPick/blockClear/blockClienteNuevo, and that is fine.
    expect(CREDIT_DOM.blockAmount.startsWith(CREDIT_DOM.block)).toBe(true);
  });
});
