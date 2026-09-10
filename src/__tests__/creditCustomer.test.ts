import { describe, it, expect } from "vitest";

/**
 * F-032, contract § 5.1, ADR 0110 — `src/lib/cuentasPorCobrar/creditCustomer.ts`, NEW.
 *
 * `resolveCreditCustomer` is the pure half of the first hard rule of the epic
 * (`creditoBase > 0 ⟹ clienteId presente y del negocio`) — the half that decides what
 * to do once the route already looked the customer up with `withTenantScope`. It never
 * queries anything itself: passing `null` for a lookup that was not performed is how
 * "not found" and "not asked" say the same thing here (contract § 5.1).
 *
 * Dynamic top-level `await import`: the module does not exist until the `implementer`
 * creates it (E-019).
 */
const { resolveCreditCustomer, CREDIT_CUSTOMER_ACTIONS } = await import(
  "@/lib/cuentasPorCobrar/creditCustomer"
);

const ROW = (id: string, deletedAt: Date | null = null) => ({ id, deletedAt });
const NUEVO_ID = "99999999-9999-9999-9999-999999999999";

describe("CREDIT_CUSTOMER_ACTIONS", () => {
  it("is exactly the four actions NONE, EXISTING, REACTIVATE, CREATE", () => {
    expect(CREDIT_CUSTOMER_ACTIONS).toEqual([
      "NONE",
      "EXISTING",
      "REACTIVATE",
      "CREATE",
    ]);
  });
});

describe("resolveCreditCustomer — the seven branches, in order", () => {
  it("branch 1: creditoBase <= 0 short-circuits to NONE regardless of everything else, even a perfectly resolvable customer", () => {
    const result = resolveCreditCustomer({
      creditoBase: 0,
      clienteId: "cliente-1",
      byId: ROW("cliente-1"),
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({ action: "NONE", clienteId: null, nombre: null });
  });

  it("branch 1 also fires for a negative creditoBase", () => {
    const result = resolveCreditCustomer({
      creditoBase: -50,
      clienteId: "cliente-1",
      byId: ROW("cliente-1"),
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result.action).toBe("NONE");
  });

  it("branch 2: clienteId present and byId found resolves EXISTING with byId.id, regardless of deletedAt (F-029 § 2.1: a soft-deleted debtor is still shown, not hidden)", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteId: "cliente-1",
      byId: ROW("cliente-1", new Date("2026-01-01")),
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({
      action: "EXISTING",
      clienteId: "cliente-1",
      nombre: null,
    });
  });

  it("branch 2 wins over a name match: clienteId's row is used even when clienteNombre also resolved to a DIFFERENT row (clienteId gana sobre clienteNombre)", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteId: "cliente-1",
      clienteNombre: "Otro Nombre",
      byId: ROW("cliente-1"),
      byNombre: ROW("cliente-2"),
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({
      action: "EXISTING",
      clienteId: "cliente-1",
      nombre: null,
    });
  });

  it("branch 3 (E-008 pair, case A): clienteId present but byId absent resolves NONE — this is the tenant half of the first hard rule (a clienteId from another negocio never resolves)", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteId: "cliente-de-otro-negocio",
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({ action: "NONE", clienteId: null, nombre: null });
  });

  it("branch 3 wins over a name match too: a clienteId that fails to resolve does not fall through to clienteNombre even when a name was also supplied and matched", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteId: "cliente-de-otro-negocio",
      clienteNombre: "Ana Pérez",
      byId: null,
      byNombre: ROW("cliente-2"),
      nuevoClienteId: NUEVO_ID,
    });
    expect(result.action).toBe("NONE");
  });

  it("branch 4: clienteNombre present, byNombre found and active resolves EXISTING with byNombre.id and a null nombre (nothing to write)", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteNombre: "Ana Pérez",
      byId: null,
      byNombre: ROW("cliente-2", null),
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({
      action: "EXISTING",
      clienteId: "cliente-2",
      nombre: null,
    });
  });

  it("branch 5: clienteNombre present, byNombre found and soft-deleted resolves REACTIVATE, with `nombre` set to the NORMALIZED name", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteNombre: "  Ana   Pérez  ",
      byId: null,
      byNombre: ROW("cliente-2", new Date("2026-01-01")),
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({
      action: "REACTIVATE",
      clienteId: "cliente-2",
      nombre: "Ana Pérez",
    });
  });

  it("branch 6: clienteNombre present, byNombre absent resolves CREATE with the caller-minted nuevoClienteId and the normalized name", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteNombre: "  Ana   Pérez  ",
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({
      action: "CREATE",
      clienteId: NUEVO_ID,
      nombre: "Ana Pérez",
    });
  });

  it("branch 6 — E-008 corrected pair (contract § 0, correction 1): the whitespace pair COLLAPSES (\"  Ana   Pérez  \" normalizes to \"Ana Pérez\"), the accent pair does NOT (normalizeClienteNombre does not fold accents, so this function must not either)", () => {
    const collapsed = resolveCreditCustomer({
      creditoBase: 100,
      clienteNombre: "  Ana   Pérez  ",
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(collapsed.nombre).toBe("Ana Pérez");

    // "Ana Perez" (no accent) is NOT what "Ana Pérez" normalizes to — passing the
    // unaccented spelling through must not silently become the accented one.
    const unaccented = resolveCreditCustomer({
      creditoBase: 100,
      clienteNombre: "Ana Perez",
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(unaccented.nombre).toBe("Ana Perez");
    expect(unaccented.nombre).not.toBe(collapsed.nombre);
  });

  it("branch 7 (E-008 pair, case B): no clienteId AND no usable clienteNombre resolves NONE — same outcome as branch 3, via a DIFFERENT condition", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result).toEqual({ action: "NONE", clienteId: null, nombre: null });
  });

  it("branch 7 also fires when clienteNombre normalizes to empty (whitespace-only) — a name that vanishes after normalizing counts as absent", () => {
    const result = resolveCreditCustomer({
      creditoBase: 400,
      clienteNombre: "    ",
      byId: null,
      byNombre: null,
      nuevoClienteId: NUEVO_ID,
    });
    expect(result.action).toBe("NONE");
  });

  it("never throws, even with a fully empty input beyond creditoBase", () => {
    expect(() =>
      resolveCreditCustomer({
        creditoBase: 500,
        byId: null,
        byNombre: null,
        nuevoClienteId: NUEVO_ID,
      }),
    ).not.toThrow();
  });
});
