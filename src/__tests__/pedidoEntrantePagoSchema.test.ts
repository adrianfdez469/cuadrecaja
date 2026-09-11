import { describe, it, expect } from "vitest";
import { pedidoEntrantePagoSchema } from "@/schemas/tiendaOnline";
import { TIENDA_ONLINE_PAYMENT_METHODS } from "@/constants/tiendaOnline";

const UUID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const UUID_CLIENTE = "3c9a6f1e-8b2d-4e77-9c3a-1f6d2b5a7e90";

/**
 * F-014/F-036 (contract § 3.2, ADR 0073, ADR 0130) — how an online order's
 * payment is declared. THREE methods now (EFECTIVO, TRANSFERENCIA, CREDITO),
 * each with its own REQUIRED/FORBIDDEN extra field per
 * TIENDA_ONLINE_PAYMENT_METHOD_FIELDS (contract § 2.2). The branches are
 * proven distinguishable (E-008), not merely individually valid.
 */
describe("pedidoEntrantePagoSchema", () => {
  it("accepts EFECTIVO with no transferDestinationId", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "EFECTIVO" }).success,
    ).toBe(true);
  });

  it("rejects EFECTIVO carrying a transferDestinationId — FORBIDDEN for EFECTIVO", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "EFECTIVO",
        transferDestinationId: UUID,
      }).success,
    ).toBe(false);
  });

  it("accepts TRANSFERENCIA with a transferDestinationId", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "TRANSFERENCIA",
        transferDestinationId: UUID,
      }).success,
    ).toBe(true);
  });

  it("rejects TRANSFERENCIA missing transferDestinationId — REQUIRED for TRANSFERENCIA", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "TRANSFERENCIA" }).success,
    ).toBe(false);
  });

  it("rejects a transferDestinationId that is not a UUID", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "TRANSFERENCIA",
        transferDestinationId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it("accepts CREDITO with a clienteId and no transferDestinationId", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "CREDITO",
        clienteId: UUID_CLIENTE,
      }).success,
    ).toBe(true);
  });

  it("rejects a clienteId that is not a UUID", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "CREDITO",
        clienteId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  // Rewritten (contract § 8.5): with two methods this title said "valid for
  // EFECTIVO and invalid for TRANSFERENCIA" and happened to still pass once
  // CREDITO was added — a bare { metodo: "CREDITO" } is ALSO invalid (it is
  // missing the now-REQUIRED clienteId) — but the title no longer described
  // what was being asserted for a third method. Generalised so it stays true
  // for however many methods TIENDA_ONLINE_PAYMENT_METHODS ends up naming.
  it.each(TIENDA_ONLINE_PAYMENT_METHODS)(
    "a bare { metodo: %s } with no extra field at all is valid ONLY for EFECTIVO",
    (metodo) => {
      const result = pedidoEntrantePagoSchema.safeParse({ metodo });

      expect(result.success).toBe(metodo === "EFECTIVO");
    },
  );

  it("rejects a metodo outside TIENDA_ONLINE_PAYMENT_METHODS", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({ metodo: "BIZUM" }).success,
    ).toBe(false);
  });

  it("rejects a missing metodo", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        transferDestinationId: UUID,
      }).success,
    ).toBe(false);
  });

  it("rejects an extra key (.strict())", () => {
    expect(
      pedidoEntrantePagoSchema.safeParse({
        metodo: "EFECTIVO",
        propina: 10,
      }).success,
    ).toBe(false);
  });

  /**
   * Contract § 3.2 / § 8.2 point 1 — the NINE combinations, "not a sample: the
   * nine", each with the exact `path` the contract names. Rows 6 and 9 — the
   * only two with BOTH extra fields present — are the ones a superRefine
   * written as "require one xor the other" would let through (contract § 3.2):
   * asserting `issues[0].path` and not merely `success: false` is what proves
   * THIS schema rejects them for the FORBIDDEN field and not by accident.
   */
  describe("the nine combinations of § 3.2", () => {
    it.each([
      // metodo, transferDestinationId, clienteId, success, issues[0].path
      ["EFECTIVO", undefined, undefined, true, undefined],
      ["EFECTIVO", UUID, undefined, false, "transferDestinationId"],
      ["EFECTIVO", undefined, UUID_CLIENTE, false, "clienteId"],
      ["TRANSFERENCIA", UUID, undefined, true, undefined],
      ["TRANSFERENCIA", undefined, undefined, false, "transferDestinationId"],
      ["TRANSFERENCIA", UUID, UUID_CLIENTE, false, "clienteId"],
      ["CREDITO", undefined, UUID_CLIENTE, true, undefined],
      ["CREDITO", undefined, undefined, false, "clienteId"],
      ["CREDITO", UUID, UUID_CLIENTE, false, "transferDestinationId"],
    ] as const)(
      "metodo=%s transferDestinationId=%s clienteId=%s -> success=%s",
      (metodo, transferDestinationId, clienteId, success, expectedPath) => {
        const body: Record<string, unknown> = { metodo };
        if (transferDestinationId !== undefined) {
          body.transferDestinationId = transferDestinationId;
        }
        if (clienteId !== undefined) {
          body.clienteId = clienteId;
        }

        const result = pedidoEntrantePagoSchema.safeParse(body);

        expect(result.success).toBe(success);
        if (!result.success) {
          // Exactly one issue per invalid row (contract § 3.2): each row has
          // only one field wrong. A schema that both required AND forbade
          // something on the same field could still produce two.
          expect(result.error.issues).toHaveLength(1);
          expect(result.error.issues[0].path).toEqual([expectedPath]);
        }
      },
    );
  });
});
