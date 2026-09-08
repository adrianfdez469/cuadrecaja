import { describe, it, expect } from "vitest";
import {
  CIERRE_OPEN_END_LABEL,
  buildCierreDateRangeLabel,
  buildCierreFileNameSlug,
  hasCierreEtiqueta,
  normalizeCierreEtiqueta,
  resolveCierreLabel,
} from "@/utils/cierreLabel";
import { CIERRE_ETIQUETA_MAX_LENGTH } from "@/constants/cierre";

/**
 * The label of a closing period. Its whole reason to exist is the backlogged
 * closing: three periods registered on the same afternoon read as three
 * identical `08/09/2026 - 08/09/2026` rows unless the operator can name them.
 */

const INICIO = new Date("2026-09-08T14:30:00");
const FIN = new Date("2026-09-08T14:47:00");

describe("buildCierreDateRangeLabel", () => {
  it("joins both dates when the period is closed", () => {
    expect(buildCierreDateRangeLabel(INICIO, FIN)).toBe(
      "08/09/2026 - 08/09/2026",
    );
  });

  it("shows the range across days when the period spans more than one", () => {
    expect(
      buildCierreDateRangeLabel(INICIO, new Date("2026-09-10T02:00:00")),
    ).toBe("08/09/2026 - 10/09/2026");
  });

  it("marks an open period as Actual instead of inventing an end date", () => {
    expect(buildCierreDateRangeLabel(INICIO)).toBe(
      `08/09/2026 - ${CIERRE_OPEN_END_LABEL}`,
    );
    expect(buildCierreDateRangeLabel(INICIO, null)).toBe(
      `08/09/2026 - ${CIERRE_OPEN_END_LABEL}`,
    );
  });

  it("accepts ISO strings, which is what the API returns before Zod coerces", () => {
    expect(
      buildCierreDateRangeLabel("2026-09-08T14:30:00", "2026-09-08T14:47:00"),
    ).toBe("08/09/2026 - 08/09/2026");
  });
});

describe("resolveCierreLabel", () => {
  it("falls back to the date range when the period is unnamed", () => {
    expect(
      resolveCierreLabel({ fechaInicio: INICIO, fechaFin: FIN }),
    ).toBe("08/09/2026 - 08/09/2026");
  });

  it("treats null, empty and blank labels as unnamed", () => {
    const rango = "08/09/2026 - 08/09/2026";
    for (const etiqueta of [null, undefined, "", "   ", "\t\n"]) {
      expect(
        resolveCierreLabel({ etiqueta, fechaInicio: INICIO, fechaFin: FIN }),
      ).toBe(rango);
    }
  });

  it("uses the operator's label when there is one", () => {
    expect(
      resolveCierreLabel({
        etiqueta: "03/09/2026 — cierre atrasado",
        fechaInicio: INICIO,
        fechaFin: FIN,
      }),
    ).toBe("03/09/2026 — cierre atrasado");
  });

  it("distinguishes three closings registered the same day — the case this exists for", () => {
    const etiquetas = ["Día 05/09", "Día 06/09", "Día 07/09"].map((etiqueta) =>
      resolveCierreLabel({ etiqueta, fechaInicio: INICIO, fechaFin: FIN }),
    );
    expect(new Set(etiquetas).size).toBe(3);
  });
});

describe("hasCierreEtiqueta", () => {
  it("is false for null, empty and blank", () => {
    expect(hasCierreEtiqueta(null)).toBe(false);
    expect(hasCierreEtiqueta(undefined)).toBe(false);
    expect(hasCierreEtiqueta("")).toBe(false);
    expect(hasCierreEtiqueta("   ")).toBe(false);
  });

  it("is true for any label with content", () => {
    expect(hasCierreEtiqueta("Turno noche")).toBe(true);
  });
});

describe("normalizeCierreEtiqueta", () => {
  it("trims the edges", () => {
    expect(normalizeCierreEtiqueta("  Turno noche  ")).toBe("Turno noche");
  });

  it("collapses runs of whitespace, including newlines pasted in", () => {
    expect(normalizeCierreEtiqueta("Cierre\n\natrasado   del  05")).toBe(
      "Cierre atrasado del 05",
    );
  });

  it("returns null for anything with no content, which is how the label is cleared", () => {
    expect(normalizeCierreEtiqueta(null)).toBeNull();
    expect(normalizeCierreEtiqueta(undefined)).toBeNull();
    expect(normalizeCierreEtiqueta("")).toBeNull();
    expect(normalizeCierreEtiqueta("   \n ")).toBeNull();
  });

  it("cuts to the maximum length without leaving a trailing space", () => {
    const larga = `${"a".repeat(CIERRE_ETIQUETA_MAX_LENGTH - 1)} bbbbb`;
    const normalizada = normalizeCierreEtiqueta(larga);
    expect(normalizada).toBe("a".repeat(CIERRE_ETIQUETA_MAX_LENGTH - 1));
    expect(normalizada!.length).toBeLessThanOrEqual(CIERRE_ETIQUETA_MAX_LENGTH);
  });

  it("is idempotent: normalizing an already normalized label changes nothing", () => {
    const once = normalizeCierreEtiqueta("  Cierre   atrasado  ");
    expect(normalizeCierreEtiqueta(once)).toBe(once);
  });
});

describe("buildCierreFileNameSlug", () => {
  it("turns the date range into a name a file system accepts", () => {
    expect(
      buildCierreFileNameSlug({ fechaInicio: INICIO, fechaFin: FIN }),
    ).toBe("08-09-2026_-_08-09-2026");
  });

  it("gives three closings of the same day three different file names", () => {
    const nombres = ["Día 05/09", "Día 06/09", "Día 07/09"].map((etiqueta) =>
      buildCierreFileNameSlug({ etiqueta, fechaInicio: INICIO, fechaFin: FIN }),
    );
    expect(nombres).toEqual(["Día_05-09", "Día_06-09", "Día_07-09"]);
    expect(new Set(nombres).size).toBe(3);
  });

  it("drops punctuation but keeps accented letters and ñ", () => {
    expect(
      buildCierreFileNameSlug({
        etiqueta: "Cierre atrasado: ¡mañana!",
        fechaInicio: INICIO,
      }),
    ).toBe("Cierre_atrasado_mañana");
  });

  it("never leaves a separator dangling at either end", () => {
    const slug = buildCierreFileNameSlug({
      etiqueta: "-- turno noche --",
      fechaInicio: INICIO,
    });
    expect(slug).toBe("turno_noche");
  });

  it("falls back to a usable name when the label has nothing a file may hold", () => {
    expect(
      buildCierreFileNameSlug({ etiqueta: "¿¡...!?", fechaInicio: INICIO }),
    ).toBe("cierre");
  });
});
