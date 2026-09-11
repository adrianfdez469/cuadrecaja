import { describe, it, expect } from "vitest";
import {
  TIENDA_ONLINE_PAYMENT_METHODS,
  TIENDA_ONLINE_PAYMENT_METHOD_FIELDS,
  TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS,
  TIENDA_ONLINE_PAYMENT_FIELD_RULES,
  TIENDA_ONLINE_CREDIT_TENANT_ERROR,
  TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN,
} from "@/constants/tiendaOnline";

/**
 * F-036 (contract § 2.2, § 2.4, § 8.2 points 4 and 5). A NEW file and not an
 * extension of `tiendaOnlineLandingConstants.test.ts` or
 * `pedidoEntrantePagoSchema.test.ts`: every symbol imported above is marked
 * NUEVO in contract § 8.1 and does not exist until the `implementer` writes
 * it. Importing a not-yet-existing symbol into an existing, already-green
 * file fails at COLLECTION and takes the whole file down, passing tests
 * included (E-019) — isolating them here keeps a red result contained.
 */

describe("TIENDA_ONLINE_PAYMENT_METHOD_FIELDS — total and consistent (contract § 8.2 point 4)", () => {
  it("has exactly one row per TIENDA_ONLINE_PAYMENT_METHODS value, no more and no fewer", () => {
    const rowKeys = Object.keys(TIENDA_ONLINE_PAYMENT_METHOD_FIELDS).sort();
    const methodKeys = [...TIENDA_ONLINE_PAYMENT_METHODS].sort();

    expect(rowKeys).toEqual(methodKeys);
  });

  it.each(TIENDA_ONLINE_PAYMENT_METHODS)(
    "%s has a rule for every TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS entry, each a valid TIENDA_ONLINE_PAYMENT_FIELD_RULES value",
    (metodo) => {
      const row = TIENDA_ONLINE_PAYMENT_METHOD_FIELDS[metodo];

      for (const field of TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS) {
        expect(TIENDA_ONLINE_PAYMENT_FIELD_RULES).toContain(row[field]);
      }
      // No key beyond the declared extra fields (a stray field would silently
      // never be validated by the schema's loop over TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS).
      expect(Object.keys(row).sort()).toEqual(
        [...TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS].sort(),
      );
    },
  );

  it("each method marks AT MOST ONE extra field REQUIRED — never two, which is what makes 'one extra field per method' (contract § 6.4) checkable", () => {
    for (const metodo of TIENDA_ONLINE_PAYMENT_METHODS) {
      const row = TIENDA_ONLINE_PAYMENT_METHOD_FIELDS[metodo];
      const requiredCount = TIENDA_ONLINE_PAYMENT_EXTRA_FIELDS.filter(
        (field) => row[field] === "REQUIRED",
      ).length;

      expect(requiredCount).toBeLessThanOrEqual(1);
    }
  });

  it("CREDITO requires clienteId and forbids transferDestinationId — the row this feature adds", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_FIELDS.CREDITO).toEqual({
      transferDestinationId: "FORBIDDEN",
      clienteId: "REQUIRED",
    });
  });

  it("EFECTIVO forbids both extra fields; TRANSFERENCIA requires the destination and forbids the debtor — unchanged by this feature", () => {
    expect(TIENDA_ONLINE_PAYMENT_METHOD_FIELDS.EFECTIVO).toEqual({
      transferDestinationId: "FORBIDDEN",
      clienteId: "FORBIDDEN",
    });
    expect(TIENDA_ONLINE_PAYMENT_METHOD_FIELDS.TRANSFERENCIA).toEqual({
      transferDestinationId: "REQUIRED",
      clienteId: "FORBIDDEN",
    });
  });
});

describe("TIENDA_ONLINE_CREDIT_TENANT_ERROR — the frozen 16-character literal (contract § 2.4, § 8.2 point 5)", () => {
  // Both halves of the claim, not just one (contract § 8.2 point 5): the
  // literal must MATCH the pattern AND sit exactly at its 16-character edge,
  // with no margin left. A `.test()` alone would stay green for a shorter
  // rename that quietly loses the "at the edge" property this test exists to
  // guard: a longer rename degrades the divergence line to UNKNOWN silently.
  it("matches TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN", () => {
    expect(
      TIENDA_ONLINE_ORDER_STATUS_CAUSE_PATTERN.test(
        TIENDA_ONLINE_CREDIT_TENANT_ERROR,
      ),
    ).toBe(true);
  });

  it("is exactly 16 characters long — the pattern's own limit, with zero margin", () => {
    expect(TIENDA_ONLINE_CREDIT_TENANT_ERROR).toHaveLength(16);
  });
});
