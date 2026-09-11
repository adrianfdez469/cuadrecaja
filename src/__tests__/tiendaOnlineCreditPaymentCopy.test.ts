import { describe, it, expect } from "vitest";
import {
  TIENDA_ONLINE_PAYMENT_METHOD_LABELS,
  TIENDA_ONLINE_ORDER_COPY,
  orderLandingBlockedCopy,
} from "@/components/tiendaOnline/orderPresentation";
import { VENTA_CREDITO_COPY } from "@/constants/ventaCredito";
import { CREDIT_CHECKOUT_COPY } from "@/constants/creditoVenta";

/**
 * F-036, the (4b) additions of contract § 8.2 (points 6, 7, 8) — the three
 * copy-only assertions the ui-designer pass levied. A NEW file and not an
 * extension of `orderLandingPresentation.test.ts`: `TIENDA_ONLINE_ORDER_COPY`
 * gains three keys this feature adds (`pagoClienteRotulo`, `pagoClienteElegir`,
 * `pagoFaltaCliente`) and `TIENDA_ONLINE_PAYMENT_METHOD_LABELS` gains the
 * `CREDITO` row — none of those exist until the `implementer` writes them, and
 * importing a not-yet-existing symbol into the existing, already-green
 * `orderLandingPresentation.test.ts` fails at COLLECTION and would take every
 * one of its passing tests down with it (E-019).
 */

describe("TIENDA_ONLINE_PAYMENT_METHOD_LABELS.CREDITO === the POS's own credit vocabulary (contract § 8.2 point 6, § 8.2.1)", () => {
  // Accepted by the contract, not proposed by this suite (§ 8.2.1): the four
  // apparitions of the literal "A crédito" verified by grep against src/ are
  // compared, not just the one the ui-designer's own design doc named. Left
  // as a plain toBe against each: if a future edit moves only one of the four,
  // this is the test that has to fail, and it has to say WHICH pair diverged.
  it("equals VENTA_CREDITO_COPY.chipConSaldo", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_LABELS.CREDITO).toBe(
      VENTA_CREDITO_COPY.chipConSaldo,
    );
  });

  it("equals CREDIT_CHECKOUT_COPY.addPaymentRow", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_LABELS.CREDITO).toBe(
      CREDIT_CHECKOUT_COPY.addPaymentRow,
    );
  });

  it("equals CREDIT_CHECKOUT_COPY.blockTitle", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_LABELS.CREDITO).toBe(
      CREDIT_CHECKOUT_COPY.blockTitle,
    );
  });

  it("is literally 'A crédito' — the shared vocabulary this equality protects", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_LABELS.CREDITO).toBe("A crédito");
  });
});

describe("TIENDA_ONLINE_ORDER_COPY.pagoSinDestinos — the frozen prefix (contract § 8.3)", () => {
  // Contract § 8.3: F-014 criterion 15 (`.agents/designs/F-014.md` line 1196)
  // already reads this SHORT substring, not the full sentence. Editing the
  // string's tail (§ 2.4 of the design contract) must leave this prefix
  // byte-for-byte intact, or a criterion already closed for F-014 breaks.
  it("still starts with the exact substring F-014 criterion 15 already reads", () => {
    expect(TIENDA_ONLINE_ORDER_COPY.pagoSinDestinos.startsWith(
      "Este local no tiene destinos de transferencia configurados",
    )).toBe(true);
  });

  // The new tail this feature adds: crédito is now an alternative to cash
  // when there are no transfer destinations configured.
  it("now also mentions crédito as an alternative to cash", () => {
    expect(TIENDA_ONLINE_ORDER_COPY.pagoSinDestinos).toContain(
      "o registra el cobro en efectivo o a crédito.",
    );
  });
});

describe("TIENDA_ONLINE_ORDER_COPY — the three new keys (contract § 8.2 point 8)", () => {
  it.each(["pagoClienteRotulo", "pagoClienteElegir", "pagoFaltaCliente"] as const)(
    "%s is defined and non-empty",
    (key) => {
      const value = TIENDA_ONLINE_ORDER_COPY[key];

      expect(typeof value).toBe("string");
      expect((value as string).length).toBeGreaterThan(0);
    },
  );
});

describe("orderLandingBlockedCopy('UNKNOWN_CLIENTE') — actually added, not just total (contract § 8.2 point 8)", () => {
  // orderLandingBlockedCopy is TOTAL over any string (orderLandingPresentation.test.ts
  // already proves that), so a bare `toBeTruthy()` here would pass even if
  // nobody had added the UNKNOWN_CLIENTE entry to BLOCKED_COPY — it would just
  // fall through to BLOCKED_FALLBACK (E-008). The discriminating assertion is
  // that a KNOWN reason and a reason this feature invents both resolve to
  // something, but to DIFFERENT somethings.
  it("differs from the fallback sentence an unrecognised reason gets", () => {
    const known = orderLandingBlockedCopy("UNKNOWN_CLIENTE");
    const fallback = orderLandingBlockedCopy(
      "A_REASON_THIS_FEATURE_NEVER_DECLARES",
    );

    expect(known).toBeTruthy();
    expect(known).not.toBe(fallback);
  });
});
