import { describe, it, expect } from "vitest";
import { TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR } from "@/schemas/cuentaPorCobrar";
import { CUENTAS_POR_COBRAR_PERMISO as CUENTAS_POR_COBRAR_PERMISO_DE_CLIENTES } from "@/constants/clientes";
import { permisosTemplates } from "@/constants/permisos/permisos.templates";

/**
 * F-033 — `src/constants/cuentasPorCobrar.ts` (contract § 1, and design § 7 "En
 * constants.ts — tres"). Covers testability symbols 9, 10, 21, 22, 23, plus the
 * re-exports § 1 requires (never a second declaration, E-039).
 *
 * Dynamic import (E-019): the module does not exist until the `implementer` creates it.
 */
const {
  CUENTAS_POR_COBRAR_PERMISO,
  CUENTAS_POR_COBRAR_PERMISO_COBRAR,
  CUENTAS_POR_COBRAR_PERMISO_PERDONAR,
  CUENTAS_POR_COBRAR_PERMISO_REVERTIR,
  TIPO_MOVIMIENTO_LABEL,
  CUENTAS_POR_COBRAR_API_ERRORS,
  TIPO_MOVIMIENTO_HUE,
  countFiltrosActivos,
  describeFiltros,
} = await import("@/constants/cuentasPorCobrar");
const { TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR: reExported } = await import(
  "@/constants/cuentasPorCobrar"
);

describe("Permission constants — literal strings fixed by contract § 1", () => {
  it("CUENTAS_POR_COBRAR_PERMISO_COBRAR is the exact literal the routes and criterion 12 name", () => {
    expect(CUENTAS_POR_COBRAR_PERMISO_COBRAR).toBe("operaciones.cuentasporcobrar.cobrar");
  });

  it("CUENTAS_POR_COBRAR_PERMISO_PERDONAR and _REVERTIR are distinct, one per action", () => {
    expect(CUENTAS_POR_COBRAR_PERMISO_PERDONAR).toBe("operaciones.cuentasporcobrar.perdonar");
    expect(CUENTAS_POR_COBRAR_PERMISO_REVERTIR).toBe("operaciones.cuentasporcobrar.revertir");
    expect(CUENTAS_POR_COBRAR_PERMISO_COBRAR).not.toBe(CUENTAS_POR_COBRAR_PERMISO_PERDONAR);
    expect(CUENTAS_POR_COBRAR_PERMISO_PERDONAR).not.toBe(CUENTAS_POR_COBRAR_PERMISO_REVERTIR);
  });

  it("CUENTAS_POR_COBRAR_PERMISO is RE-EXPORTED from src/constants/clientes.ts, not redeclared (E-039)", () => {
    expect(CUENTAS_POR_COBRAR_PERMISO).toBe(CUENTAS_POR_COBRAR_PERMISO_DE_CLIENTES);
  });
});

describe("TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR — re-exported from src/schemas/cuentaPorCobrar.ts, never restated (E-014, E-039)", () => {
  it("is the SAME array (by value) as the schema module's own list", () => {
    expect(reExported).toEqual(TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR);
  });
});

describe("TIPO_MOVIMIENTO_LABEL — ADR 0115: the enum says CONDONACION, the label says 'perdonar'", () => {
  it("has exactly the four documented keys", () => {
    expect(Object.keys(TIPO_MOVIMIENTO_LABEL).sort()).toEqual(
      [...TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR].sort(),
    );
  });

  it("CONDONACION's label is 'Perdon de deuda' — the base's own vocabulary is untouched (ADR 0115)", () => {
    expect(TIPO_MOVIMIENTO_LABEL.CONDONACION).toBe("Perdon de deuda");
  });

  it("every other label is the exact contract text", () => {
    expect(TIPO_MOVIMIENTO_LABEL.ABONO).toBe("Abono");
    expect(TIPO_MOVIMIENTO_LABEL.AJUSTE_DEVOLUCION).toBe("Ajuste por devolucion");
    expect(TIPO_MOVIMIENTO_LABEL.REVERSION_ABONO).toBe("Reversion de abono");
  });
});

describe("CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente — criterion 9, E-016: the figure travels as a NUMBER inside the text", () => {
  it("the message contains the exact figure, not just a generic phrase", () => {
    const message = CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente(500);
    expect(message).toContain("500");
    expect(message).toBe(
      "El monto supera el saldo pendiente de la cuenta, que es 500",
    );
  });

  it("changes with the figure — it is not a fixed string that happens to contain a 500 once", () => {
    expect(CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente(300)).toContain("300");
    expect(CUENTAS_POR_COBRAR_API_ERRORS.saldoInsuficiente(300)).not.toContain("500");
  });

  it("nadaQuePerdonar is the fixed literal from the contract (§ 5.3, decision B2)", () => {
    expect(CUENTAS_POR_COBRAR_API_ERRORS.nadaQuePerdonar).toBe(
      "Esta deuda ya esta saldada: no hay nada que perdonar",
    );
  });
});

describe("TIPO_MOVIMIENTO_HUE — design symbol 21: four hues, none is 'accent' (violet is reserved for action/selection)", () => {
  it("has exactly the four movement-type keys", () => {
    expect(Object.keys(TIPO_MOVIMIENTO_HUE).sort()).toEqual(
      [...TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR].sort(),
    );
  });

  it("no value is 'accent'", () => {
    expect(Object.values(TIPO_MOVIMIENTO_HUE)).not.toContain("accent");
  });

  it("matches the documented tint per type", () => {
    expect(TIPO_MOVIMIENTO_HUE.ABONO).toBe("positive");
    expect(TIPO_MOVIMIENTO_HUE.CONDONACION).toBe("negative");
    expect(TIPO_MOVIMIENTO_HUE.REVERSION_ABONO).toBe("caution");
    expect(TIPO_MOVIMIENTO_HUE.AJUSTE_DEVOLUCION).toBe("info");
  });
});

describe("countFiltrosActivos — design symbol 22", () => {
  it("counts 0 for an empty filter set", () => {
    expect(countFiltrosActivos({})).toBe(0);
  });

  it("counts 1 for a single active filter", () => {
    expect(countFiltrosActivos({ estado: "CON_DEUDA" })).toBe(1);
  });

  it("counts all four when all four are set", () => {
    expect(
      countFiltrosActivos({
        clienteId: crypto.randomUUID(),
        tiendaId: crypto.randomUUID(),
        antiguedad: "31-60",
        estado: "CON_DEUDA",
      }),
    ).toBe(4);
  });

  it("an explicit undefined does not count as active", () => {
    expect(countFiltrosActivos({ tiendaId: undefined })).toBe(0);
  });
});

describe("describeFiltros — design symbol 23", () => {
  it("returns null when no filter is active, regardless of the options given", () => {
    expect(describeFiltros({}, { tiendas: [], deudores: [] })).toBeNull();
  });

  // NOTE (see report to the coordinator): the exact shape of `opciones` is not fixed by
  // either the contract or the design document — only the joined-output examples are
  // ("Tienda Centro", "Tienda Centro · 31-60 días"). The two cases below use the most
  // directly supported reading (an array of {id, nombre} per universe, named after the
  // universes § "Los filtros" of the design describes: tiendas and deudores/clientes).
  // If the implementer names these fields differently, these two assertions — and ONLY
  // these two — will fail on a shape mismatch rather than a logic error; the empty-filter
  // case above does not depend on this guess at all.
  it("resolves a single tienda filter to its label, not its id", () => {
    const tiendaId = crypto.randomUUID();
    const resultado = describeFiltros(
      { tiendaId },
      { tiendas: [{ id: tiendaId, nombre: "Tienda Centro" }], deudores: [] },
    );
    expect(resultado).toBe("Tienda Centro");
  });

  it("joins active filters with ' · ' in the fixed order Deudor -> Tienda -> Antiguedad -> Estado", () => {
    const tiendaId = crypto.randomUUID();
    const resultado = describeFiltros(
      { tiendaId, antiguedad: "31-60" },
      { tiendas: [{ id: tiendaId, nombre: "Tienda Centro" }], deudores: [] },
    );
    expect(resultado).toBe("Tienda Centro · 31-60 días");
  });
});

describe("Permission templates — data half of criterion 12: a VENDEDOR does not get any of the three new permissions", () => {
  it("vendedor's template does NOT include cobrar, perdonar or revertir", () => {
    expect(permisosTemplates.vendedor).not.toContain(CUENTAS_POR_COBRAR_PERMISO_COBRAR);
    expect(permisosTemplates.vendedor).not.toContain(CUENTAS_POR_COBRAR_PERMISO_PERDONAR);
    expect(permisosTemplates.vendedor).not.toContain(CUENTAS_POR_COBRAR_PERMISO_REVERTIR);
  });

  it("almacenero's template does NOT include them either (contract § 6.2)", () => {
    expect(permisosTemplates.almacenero).not.toContain(CUENTAS_POR_COBRAR_PERMISO_COBRAR);
    expect(permisosTemplates.almacenero).not.toContain(CUENTAS_POR_COBRAR_PERMISO_PERDONAR);
    expect(permisosTemplates.almacenero).not.toContain(CUENTAS_POR_COBRAR_PERMISO_REVERTIR);
  });

  it("administrador's template DOES include all three (contract § 6.2) — the control positive of the two checks above", () => {
    expect(permisosTemplates.administrador).toContain(CUENTAS_POR_COBRAR_PERMISO_COBRAR);
    expect(permisosTemplates.administrador).toContain(CUENTAS_POR_COBRAR_PERMISO_PERDONAR);
    expect(permisosTemplates.administrador).toContain(CUENTAS_POR_COBRAR_PERMISO_REVERTIR);
  });
});
