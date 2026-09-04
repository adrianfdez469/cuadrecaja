import { describe, it, expect } from "vitest";
import {
  QAB_ORDER_STATUSES,
  QAB_STORE_SYNC_STATES,
  QAB_STORE_SYNC_CODES,
  QAB_SLUG_UPSTREAM_CODES,
  QAB_STORE_DESCRIPTION_MAX_LENGTH,
  QAB_STORE_ADDRESS_MAX_LENGTH,
  QAB_STORE_PHONE_MAX_LENGTH,
  QAB_STORE_EMAIL_MAX_LENGTH,
} from "@/constants/qab";
import {
  tiendaOnlineEstadoSchema,
  tiendaOnlineScaffoldSchema,
  pedidoEntranteStatusUpdateSchema,
  qabStoreSyncStateSchema,
  tiendaOnlineLocalSchema,
  tiendaOnlineConfiguracionSchema,
  tiendaOnlineLocalUpdateSchema,
  tiendaOnlineLocalUpdateResultSchema,
  tiendaOnlineSlugForecastSchema,
  tiendaOnlineSlugErrorSchema,
} from "@/schemas/tiendaOnline";

/**
 * F-004 — the three Zod schemas of `src/schemas/tiendaOnline.ts`. All `.strict()`, following
 * the precedent of `src/schemas/qabNegocio.ts` (ADR 0025): an extra key on the object being
 * parsed must make `parse` throw, not silently drop it.
 */

describe("tiendaOnlineEstadoSchema", () => {
  it("should accept { tiendaOnlineHabilitada: true }", () => {
    expect(
      tiendaOnlineEstadoSchema.parse({ tiendaOnlineHabilitada: true }),
    ).toEqual({ tiendaOnlineHabilitada: true });
  });

  it("should accept { tiendaOnlineHabilitada: false }", () => {
    expect(
      tiendaOnlineEstadoSchema.parse({ tiendaOnlineHabilitada: false }),
    ).toEqual({ tiendaOnlineHabilitada: false });
  });

  it("should reject a non-boolean value", () => {
    const result = tiendaOnlineEstadoSchema.safeParse({
      tiendaOnlineHabilitada: "true",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = tiendaOnlineEstadoSchema.safeParse({
      tiendaOnlineHabilitada: true,
      negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    });

    expect(result.success).toBe(false);
  });
});

describe("tiendaOnlineScaffoldSchema", () => {
  const base = {
    negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    tiendaOnlineHabilitada: true as const,
  };

  it("should accept negocioId + tiendaOnlineHabilitada: true", () => {
    expect(tiendaOnlineScaffoldSchema.parse(base)).toEqual(base);
  });

  it("should reject tiendaOnlineHabilitada: false — this is the switch-off canary (z.literal(true))", () => {
    // Contract §6: this literal is deliberate. If the server-side gate ever let a disabled
    // business through, this parse is what makes it explode into a 500 instead of leaking a
    // 200 with false content.
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      tiendaOnlineHabilitada: false,
    });

    expect(result.success).toBe(false);
  });

  it("should reject a negocioId that is not a UUID", () => {
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      negocioId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = tiendaOnlineScaffoldSchema.safeParse({
      ...base,
      qabToken: "should-never-be-here",
    });

    expect(result.success).toBe(false);
  });
});

describe("pedidoEntranteStatusUpdateSchema", () => {
  it.each(QAB_ORDER_STATUSES)("should accept status %s", (status) => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({ status });

    expect(result.success).toBe(true);
  });

  it("should reject a status value outside QAB_ORDER_STATUSES", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: "NOT_A_REAL_STATUS",
    });

    expect(result.success).toBe(false);
  });

  it("should reject a missing status", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: QAB_ORDER_STATUSES[0],
      negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    });

    expect(result.success).toBe(false);
  });

  it("should NOT validate whether the transition itself is legal — shape only (F-011's job)", () => {
    // Contract §2 is explicit: "every value of the enum parses here, including nonsensical
    // ones". A nonsense-but-in-enum transition (e.g. going back to PENDING) must still parse.
    const result = pedidoEntranteStatusUpdateSchema.safeParse({
      status: "PENDING",
    });

    expect(result.success).toBe(true);
  });
});

/**
 * F-005 — `src/schemas/tiendaOnline.ts` §4, the API of the online-store configuration screen.
 * `tiendaOnlineScaffoldSchema` is extended (`.extend`), never replaced (spec §"Lo que ya
 * existe"); the tests above for it stay valid untouched.
 */

const validCalendar = {
  version: 1,
  days: { mon: [{ from: "09:00", to: "17:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
};

describe("qabStoreSyncStateSchema", () => {
  it("should accept a SYNCED state with a null code", () => {
    expect(
      qabStoreSyncStateSchema.safeParse({ state: "SYNCED", code: null, attempts: 0, since: null }).success
    ).toBe(true);
  });

  it.each([...QAB_STORE_SYNC_STATES])("should accept the state %s", (state) => {
    expect(
      qabStoreSyncStateSchema.safeParse({ state, code: null, attempts: 0, since: null }).success
    ).toBe(true);
  });

  it.each([...QAB_STORE_SYNC_CODES])("should accept the sync code %s", (code) => {
    expect(
      qabStoreSyncStateSchema.safeParse({ state: "FAILED", code, attempts: 1, since: null }).success
    ).toBe(true);
  });

  it("should reject a state outside QAB_STORE_SYNC_STATES", () => {
    expect(
      qabStoreSyncStateSchema.safeParse({ state: "RETRYING", code: null, attempts: 0, since: null })
        .success
    ).toBe(false);
  });

  it("should reject a negative attempts count", () => {
    expect(
      qabStoreSyncStateSchema.safeParse({ state: "FAILED", code: "TRANSPORT", attempts: -1, since: null })
        .success
    ).toBe(false);
  });

  it("should reject an extra key (.strict())", () => {
    expect(
      qabStoreSyncStateSchema.safeParse({
        state: "SYNCED",
        code: null,
        attempts: 0,
        since: null,
        raw: "should not be here",
      }).success
    ).toBe(false);
  });
});

const validLocal = {
  id: "a3f1a1a1-1111-4111-8111-111111111111",
  nombre: "Sucursal Vedado",
  tipo: "TIENDA",
  publicarEnTienda: true,
  slug: "sucursal-vedado",
  slugQab: null,
  descripcion: null,
  direccion: null,
  ciudad: null,
  provincia: null,
  latitud: null,
  longitud: null,
  telefono: null,
  whatsapp: null,
  email: null,
  horarios: null,
  horariosInvalid: false,
  motivoDespublicacion: null,
  publishable: true,
  firstPublishPending: true,
  syncState: { state: "SYNCED", code: null, attempts: 0, since: null },
};

describe("tiendaOnlineLocalSchema", () => {
  it("should accept a well formed local", () => {
    expect(tiendaOnlineLocalSchema.safeParse(validLocal).success).toBe(true);
  });

  it("should accept publishable: false for an ALMACEN", () => {
    expect(
      tiendaOnlineLocalSchema.safeParse({ ...validLocal, tipo: "ALMACEN", publishable: false }).success
    ).toBe(true);
  });

  it("should accept a valid calendar in horarios", () => {
    expect(
      tiendaOnlineLocalSchema.safeParse({ ...validLocal, horarios: validCalendar }).success
    ).toBe(true);
  });

  it("should reject a motivoDespublicacion over 160 characters", () => {
    expect(
      tiendaOnlineLocalSchema.safeParse({
        ...validLocal,
        motivoDespublicacion: "x".repeat(161),
      }).success
    ).toBe(false);
  });

  it("should reject an extra key (.strict()) — e.g. a smuggled qabToken", () => {
    expect(
      tiendaOnlineLocalSchema.safeParse({ ...validLocal, qabToken: "should-never-be-here" }).success
    ).toBe(false);
  });

  it("should reject a missing syncState", () => {
    const { syncState: _omitted, ...withoutSyncState } = validLocal;
    expect(tiendaOnlineLocalSchema.safeParse(withoutSyncState).success).toBe(false);
  });
});

describe("tiendaOnlineConfiguracionSchema", () => {
  const base = {
    negocioId: "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e",
    tiendaOnlineHabilitada: true as const,
    locales: [validLocal],
  };

  it("should accept the scaffold fields plus a locales array", () => {
    expect(tiendaOnlineConfiguracionSchema.safeParse(base).success).toBe(true);
  });

  it("should accept an empty locales array (a business with no tiendas yet)", () => {
    expect(tiendaOnlineConfiguracionSchema.safeParse({ ...base, locales: [] }).success).toBe(true);
  });

  it("should still reject tiendaOnlineHabilitada: false — the F-004 switch-off canary survives the .extend()", () => {
    expect(
      tiendaOnlineConfiguracionSchema.safeParse({ ...base, tiendaOnlineHabilitada: false }).success
    ).toBe(false);
  });

  it("should reject a malformed entry inside locales", () => {
    expect(
      tiendaOnlineConfiguracionSchema.safeParse({ ...base, locales: [{ ...validLocal, id: "not-a-uuid" }] })
        .success
    ).toBe(false);
  });
});

const validUpdate = {
  publicarEnTienda: true,
  slug: "sucursal-vedado",
  descripcion: null,
  direccion: null,
  ciudad: null,
  provincia: null,
  latitud: null,
  longitud: null,
  telefono: null,
  whatsapp: null,
  email: null,
  horarios: null,
  motivoDespublicacion: null,
};

describe("tiendaOnlineLocalUpdateSchema", () => {
  it("should accept a well formed full-replacement body", () => {
    expect(tiendaOnlineLocalUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("should reject a body missing one of the required keys — it is a FULL replacement, not a partial", () => {
    const { motivoDespublicacion: _omitted, ...partial } = validUpdate;
    expect(tiendaOnlineLocalUpdateSchema.safeParse(partial).success).toBe(false);
  });

  it("should reject a slugQab key — QAB owns it, this schema never accepts it", () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, slugQab: "should-not-be-writable" })
        .success
    ).toBe(false);
  });

  it.each(["descripcion", "direccion", "ciudad", "provincia", "telefono", "whatsapp"] as const)(
    "nullableText: an empty string in %s becomes null (an emptied field means DELETE, not \"\")",
    (field) => {
      const parsed = tiendaOnlineLocalUpdateSchema.parse({ ...validUpdate, [field]: "" });
      expect(parsed[field]).toBeNull();
    }
  );

  it("nullableText: surrounding whitespace is trimmed", () => {
    const parsed = tiendaOnlineLocalUpdateSchema.parse({ ...validUpdate, descripcion: "  Bodega  " });
    expect(parsed.descripcion).toBe("Bodega");
  });

  it("nullableText: whitespace-only input also becomes null, not a string of spaces", () => {
    const parsed = tiendaOnlineLocalUpdateSchema.parse({ ...validUpdate, direccion: "   " });
    expect(parsed.direccion).toBeNull();
  });

  it("should reject a malformed email", () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, email: "not-an-email" }).success
    ).toBe(false);
  });

  it("should accept an empty-string email as null (nullableText + isEmailOrNull)", () => {
    const parsed = tiendaOnlineLocalUpdateSchema.parse({ ...validUpdate, email: "" });
    expect(parsed.email).toBeNull();
  });

  it("should reject a latitude out of range", () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, latitud: 91 }).success
    ).toBe(false);
  });

  it("should accept a valid calendar in horarios and reject an invalid one", () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, horarios: validCalendar }).success
    ).toBe(true);
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, horarios: { version: 2, days: {} } })
        .success
    ).toBe(false);
  });

  it("should reject a motivoDespublicacion over 160 characters", () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, motivoDespublicacion: "x".repeat(161) })
        .success
    ).toBe(false);
  });

  it(`should reject a descripcion over ${QAB_STORE_DESCRIPTION_MAX_LENGTH} characters`, () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({
        ...validUpdate,
        descripcion: "x".repeat(QAB_STORE_DESCRIPTION_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it(`should reject a direccion over ${QAB_STORE_ADDRESS_MAX_LENGTH} characters`, () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({
        ...validUpdate,
        direccion: "x".repeat(QAB_STORE_ADDRESS_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it(`should reject a telefono over ${QAB_STORE_PHONE_MAX_LENGTH} characters`, () => {
    expect(
      tiendaOnlineLocalUpdateSchema.safeParse({
        ...validUpdate,
        telefono: "1".repeat(QAB_STORE_PHONE_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it(`should reject an email over ${QAB_STORE_EMAIL_MAX_LENGTH} characters`, () => {
    const longLocal = `${"a".repeat(QAB_STORE_EMAIL_MAX_LENGTH)}@example.com`;
    expect(tiendaOnlineLocalUpdateSchema.safeParse({ ...validUpdate, email: longLocal }).success).toBe(
      false
    );
  });
});

describe("tiendaOnlineLocalUpdateResultSchema", () => {
  it("should accept { local, eventId }", () => {
    expect(
      tiendaOnlineLocalUpdateResultSchema.safeParse({ local: validLocal, eventId: "123" }).success
    ).toBe(true);
  });

  it("should reject an empty eventId", () => {
    expect(
      tiendaOnlineLocalUpdateResultSchema.safeParse({ local: validLocal, eventId: "" }).success
    ).toBe(false);
  });
});

describe("tiendaOnlineSlugForecastSchema", () => {
  const validForecast = {
    candidate: "sucursal-vedado",
    available: true,
    reason: "free",
    resolvedSlug: "sucursal-vedado",
    url: "https://tienda.example/sucursal-vedado",
    storeKnown: false,
  };

  it("should accept a well formed forecast", () => {
    expect(tiendaOnlineSlugForecastSchema.safeParse(validForecast).success).toBe(true);
  });

  it("should accept a reason value OUTSIDE the six documented ones — it is an open string, not an enum (ADR 0033)", () => {
    expect(
      tiendaOnlineSlugForecastSchema.safeParse({ ...validForecast, reason: "a_seventh_reason_qab_invents_later" })
        .success
    ).toBe(true);
  });

  it("should reject a reserving key — it is deliberately NOT re-exposed", () => {
    expect(
      tiendaOnlineSlugForecastSchema.safeParse({ ...validForecast, reserving: true }).success
    ).toBe(false);
  });
});

describe("tiendaOnlineSlugErrorSchema", () => {
  const validError = {
    error: "QAB_SLUG_UPSTREAM" as const,
    qabError: "TRANSPORT" as const,
    retryable: true,
  };

  it("should accept a well formed 502 body", () => {
    expect(tiendaOnlineSlugErrorSchema.safeParse(validError).success).toBe(true);
  });

  it.each([...QAB_SLUG_UPSTREAM_CODES])("should accept the qabError code %s", (qabError) => {
    expect(tiendaOnlineSlugErrorSchema.safeParse({ ...validError, qabError }).success).toBe(true);
  });

  it('should reject an "error" value other than the fixed literal', () => {
    expect(
      tiendaOnlineSlugErrorSchema.safeParse({ ...validError, error: "SOMETHING_ELSE" }).success
    ).toBe(false);
  });

  it("should reject a qabError outside QAB_SLUG_UPSTREAM_CODES", () => {
    expect(
      tiendaOnlineSlugErrorSchema.safeParse({ ...validError, qabError: "SOMETHING_ELSE" }).success
    ).toBe(false);
  });
});
