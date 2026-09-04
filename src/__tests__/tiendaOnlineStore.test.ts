import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ITiendaOnlineLocalUpdate, IQabStoreSyncState } from "@/schemas/tiendaOnline";

/**
 * F-005 — `src/lib/tiendaOnline/tiendaOnlineStore.ts` (contract §5.1). `@/lib/prisma` is
 * mocked (external dependency, same convention as `tiendaOnlineAccess.test.ts`): the module
 * under test imports the shared `prisma` singleton and drives everything through
 * `prisma.$transaction`, so the mock supplies a fake `tx` and captures every call made on it.
 *
 * Two things carry the real weight here, straight from the spec's own warnings:
 *
 *  - Criterion 2 ("ALMACEN never publishes") has to hold with `publicarEnTienda: true` in the
 *    body -- the contract is explicit that the ALMACEN rejection can never depend on the flag's
 *    value, precisely so a body that tries to force it through does not get a different answer.
 *  - Criterion 5 / E-008: an edit that repeats the SAME publicarEnTienda value and one that
 *    actually FLIPS it are both seeded, so the assertion that "the emitted event always carries
 *    the row's own value" cannot pass by accident.
 *
 * `toTiendaOnlineLocal` is pure and gets no I/O at all.
 */

const NEGOCIO_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const TIENDA_ID = "a3f1a1a1-1111-4111-8111-111111111111";
const NOW = new Date("2026-09-03T12:00:00.000Z");

const transactionMock = vi.fn();
const tiendaFindManyMock = vi.fn().mockResolvedValue([]);
const outboxFindManyMock = vi.fn().mockResolvedValue([]);
// ADR 0035 (ciclo 2): `listTiendaOnlineLocales` also resolves the
// payload-filtered "who has ever published" question in one aggregated query
// (`readPublishedTiendaIds`, contract §5.1). None of the tests below assert
// against it, so an empty result is enough to keep them from crashing on a
// Prisma method the pre-ADR-0035 mock did not know about. The behaviour of
// this query itself is covered in `tiendaOnlineFirstPublishSignal.test.ts`.
const outboxGroupByMock = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    tienda: { findMany: tiendaFindManyMock },
    outboxEvento: { findMany: outboxFindManyMock, groupBy: outboxGroupByMock },
  },
}));

const {
  saveTiendaOnlineLocal,
  listTiendaOnlineLocales,
  toTiendaOnlineLocal,
  TiendaOnlineNotFoundError,
  TiendaOnlineAlmacenError,
  TiendaOnlineOpeningHoursError,
  TIENDA_ONLINE_LOCAL_SELECT,
} = await import("@/lib/tiendaOnline/tiendaOnlineStore");

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TIENDA_ID,
    nombre: "Sucursal Centro",
    tipo: "TIENDA",
    publicarEnTienda: true,
    slug: "sucursal-centro",
    slugQab: null,
    descripcion: null,
    direccion: null,
    ciudad: null,
    provincia: null,
    latitud: null,
    longitud: null,
    telefono: "+5350000000",
    whatsapp: null,
    email: null,
    horarios: null,
    motivoDespublicacion: null,
    negocio: { nombre: "Bodega Central" },
    ...overrides,
  };
}

function baseUpdateInput(overrides: Partial<ITiendaOnlineLocalUpdate> = {}): ITiendaOnlineLocalUpdate {
  return {
    publicarEnTienda: true,
    slug: "sucursal-centro",
    descripcion: null,
    direccion: null,
    ciudad: null,
    provincia: null,
    latitud: null,
    longitud: null,
    telefono: "+5350000000",
    whatsapp: null,
    email: null,
    horarios: null,
    motivoDespublicacion: null,
    ...overrides,
  };
}

type ITxCalls = {
  findFirst: Array<Record<string, unknown>>;
  update: Array<Record<string, unknown>>;
  outboxFindFirst: Array<Record<string, unknown>>;
  outboxCreate: Array<Record<string, unknown>>;
  order: string[];
};

function makeTx(options: {
  existingRow: Record<string, unknown> | null;
  priorOutboxEvent?: { id: bigint } | null;
}) {
  const calls: ITxCalls = { findFirst: [], update: [], outboxFindFirst: [], outboxCreate: [], order: [] };

  const tx = {
    tienda: {
      findFirst: vi.fn(async (args: Record<string, unknown>) => {
        calls.findFirst.push(args);
        calls.order.push("tienda.findFirst");
        return options.existingRow;
      }),
      update: vi.fn(async (args: Record<string, unknown>) => {
        calls.update.push(args);
        calls.order.push("tienda.update");
        const data = args.data as Record<string, unknown>;
        return { ...options.existingRow, ...data };
      }),
    },
    outboxEvento: {
      findFirst: vi.fn(async (args: Record<string, unknown>) => {
        calls.outboxFindFirst.push(args);
        calls.order.push("outboxEvento.findFirst");
        return options.priorOutboxEvent ?? null;
      }),
      create: vi.fn(async (args: Record<string, unknown>) => {
        calls.outboxCreate.push(args);
        calls.order.push("outboxEvento.create");
        return { id: BigInt(1) };
      }),
    },
  };

  return { tx, calls };
}

beforeEach(() => {
  transactionMock.mockReset();
  tiendaFindManyMock.mockReset().mockResolvedValue([]);
  outboxFindManyMock.mockReset().mockResolvedValue([]);
  outboxGroupByMock.mockReset().mockResolvedValue([]);
});

describe("TIENDA_ONLINE_LOCAL_SELECT", () => {
  it("should select exactly the columns the online-store screen and payload builder need", () => {
    expect(TIENDA_ONLINE_LOCAL_SELECT).toEqual({
      id: true,
      nombre: true,
      tipo: true,
      publicarEnTienda: true,
      slug: true,
      slugQab: true,
      descripcion: true,
      direccion: true,
      ciudad: true,
      provincia: true,
      latitud: true,
      longitud: true,
      telefono: true,
      whatsapp: true,
      email: true,
      horarios: true,
      motivoDespublicacion: true,
    });
  });
});

describe("toTiendaOnlineLocal — pure projection, no I/O", () => {
  const syncedState: IQabStoreSyncState = { state: "SYNCED", code: null, attempts: 0, since: null };

  it("should mark a TIENDA as publishable", () => {
    const local = toTiendaOnlineLocal(baseRow({ tipo: "TIENDA" }) as never, syncedState, false);
    expect(local.publishable).toBe(true);
  });

  it("should mark an ALMACEN as NOT publishable — the other branch of the same field", () => {
    const local = toTiendaOnlineLocal(baseRow({ tipo: "ALMACEN" }) as never, syncedState, false);
    expect(local.publishable).toBe(false);
  });

  it("should report horarios: null and horariosInvalid: false when there is no calendar at all", () => {
    const local = toTiendaOnlineLocal(baseRow({ horarios: null }) as never, syncedState, false);
    expect(local.horarios).toBeNull();
    expect(local.horariosInvalid).toBe(false);
  });

  it("should report horarios: null and horariosInvalid: true when the stored value does NOT validate", () => {
    const local = toTiendaOnlineLocal(
      baseRow({ horarios: { version: 2, days: {} } }) as never,
      syncedState,
      false
    );
    expect(local.horarios).toBeNull();
    expect(local.horariosInvalid).toBe(true);
  });

  it("should surface the parsed calendar and horariosInvalid: false when the stored value DOES validate", () => {
    const validCalendar = {
      version: 1,
      days: { mon: [{ from: "09:00", to: "17:00" }], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
    };
    const local = toTiendaOnlineLocal(baseRow({ horarios: validCalendar }) as never, syncedState, false);
    expect(local.horarios).toEqual(validCalendar);
    expect(local.horariosInvalid).toBe(false);
  });

  it("should pass syncState and firstPublishPending through from its own arguments, not derive them", () => {
    const failedState: IQabStoreSyncState = {
      state: "FAILED",
      code: "STORE_OPENING_HOURS_INVALID",
      attempts: 2,
      since: "2026-09-01T00:00:00.000Z",
    };
    const local = toTiendaOnlineLocal(baseRow() as never, failedState, true);
    expect(local.syncState).toEqual(failedState);
    expect(local.firstPublishPending).toBe(true);
  });

  it("should carry every other field through unchanged, nulls included", () => {
    const row = baseRow({ descripcion: null, latitud: null, slugQab: "sucursal-centro-2" });
    const local = toTiendaOnlineLocal(row as never, syncedState, false);

    expect(local.id).toBe(TIENDA_ID);
    expect(local.nombre).toBe("Sucursal Centro");
    expect(local.descripcion).toBeNull();
    expect(local.latitud).toBeNull();
    expect(local.slugQab).toBe("sucursal-centro-2");
  });
});

describe("saveTiendaOnlineLocal — multi-tenant isolation", () => {
  it("should read the local with BOTH id and negocioId in the where clause", async () => {
    const { tx, calls } = makeTx({ existingRow: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: baseUpdateInput(), now: () => NOW })
    ).rejects.toBeInstanceOf(TiendaOnlineNotFoundError);

    expect(calls.findFirst[0]).toMatchObject({ where: { id: TIENDA_ID, negocioId: NEGOCIO_ID } });
  });

  it("should write the update with BOTH id and negocioId in the where clause too", async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow(), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
      input: baseUpdateInput(),
      now: () => NOW,
    });

    expect(calls.update[0]).toMatchObject({ where: { id: TIENDA_ID, negocioId: NEGOCIO_ID } });
  });
});

describe("saveTiendaOnlineLocal — TiendaOnlineNotFoundError", () => {
  it("should throw when no row matches id + negocioId", async () => {
    const { tx } = makeTx({ existingRow: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: baseUpdateInput(), now: () => NOW })
    ).rejects.toBeInstanceOf(TiendaOnlineNotFoundError);
  });
});

describe("saveTiendaOnlineLocal — criterion 2: an ALMACEN never publishes, regardless of the flag", () => {
  it("should throw TiendaOnlineAlmacenError when publicarEnTienda is true in the body", async () => {
    const { tx } = makeTx({ existingRow: baseRow({ tipo: "ALMACEN" }) });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      saveTiendaOnlineLocal({
        negocioId: NEGOCIO_ID,
        tiendaId: TIENDA_ID,
        input: baseUpdateInput({ publicarEnTienda: true }),
        now: () => NOW,
      })
    ).rejects.toBeInstanceOf(TiendaOnlineAlmacenError);
  });

  it("should ALSO throw TiendaOnlineAlmacenError when publicarEnTienda is false — the check cannot depend on the flag", async () => {
    // E-008 guard: without this second branch, an implementation that only rejects when the
    // flag is true would pass the test above and still be broken (an ALMACEN could accept
    // any other edit unchallenged as long as publicarEnTienda stayed false).
    const { tx } = makeTx({ existingRow: baseRow({ tipo: "ALMACEN" }) });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      saveTiendaOnlineLocal({
        negocioId: NEGOCIO_ID,
        tiendaId: TIENDA_ID,
        input: baseUpdateInput({ publicarEnTienda: false }),
        now: () => NOW,
      })
    ).rejects.toBeInstanceOf(TiendaOnlineAlmacenError);
  });

  it("should NOT throw for the same body on a TIENDA — the discriminating control", async () => {
    const { tx } = makeTx({ existingRow: baseRow({ tipo: "TIENDA" }), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await expect(
      saveTiendaOnlineLocal({
        negocioId: NEGOCIO_ID,
        tiendaId: TIENDA_ID,
        input: baseUpdateInput({ publicarEnTienda: true }),
        now: () => NOW,
      })
    ).resolves.toBeDefined();
  });
});

describe("saveTiendaOnlineLocal — TiendaOnlineOpeningHoursError safety net", () => {
  it("should throw when horarios does not validate, even though the route is supposed to have checked already", async () => {
    const { tx } = makeTx({ existingRow: baseRow(), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    const invalidInput = baseUpdateInput({
      horarios: { version: 2, days: {} } as unknown as ITiendaOnlineLocalUpdate["horarios"],
    });

    await expect(
      saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: invalidInput, now: () => NOW })
    ).rejects.toBeInstanceOf(TiendaOnlineOpeningHoursError);
  });
});

describe("saveTiendaOnlineLocal — criterion 5 / E-008: publishToStore only changes when the input actually changes it", () => {
  it("branch A: editing only the phone, publicarEnTienda repeats its CURRENT value (true) — the event still carries true", async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow({ publicarEnTienda: true }), priorOutboxEvent: { id: BigInt(9) } });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
      input: baseUpdateInput({ publicarEnTienda: true, telefono: "+5359999999" }),
      now: () => NOW,
    });

    const payload = calls.outboxCreate[0].data as { payload: { publishToStore: boolean } };
    expect(payload.payload.publishToStore).toBe(true);
  });

  it("branch B (the discriminating control, E-008): a genuine flip of publicarEnTienda IS carried through to the event", async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow({ publicarEnTienda: true }), priorOutboxEvent: { id: BigInt(9) } });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
      input: baseUpdateInput({ publicarEnTienda: false, motivoDespublicacion: "Cerrado por inventario" }),
      now: () => NOW,
    });

    const payload = calls.outboxCreate[0].data as { payload: { publishToStore: boolean; unpublishReason: string } };
    expect(payload.payload.publishToStore).toBe(false);
    expect(payload.payload.unpublishReason).toBe("Cerrado por inventario");
  });

  it("should emit an event on EVERY successful PATCH, even one that changes nothing else material", async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow(), priorOutboxEvent: { id: BigInt(9) } });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
      input: baseUpdateInput(),
      now: () => NOW,
    });

    expect(calls.outboxCreate).toHaveLength(1);
  });
});

describe("saveTiendaOnlineLocal — firstPublishPending drives CREATE vs UPDATE", () => {
  it('should enqueue operacion "CREATE" when no prior STORE event exists for this local', async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow(), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: baseUpdateInput(), now: () => NOW });

    expect(calls.outboxFindFirst[0]).toMatchObject({
      where: { negocioId: NEGOCIO_ID, entidad: "STORE", entidadId: TIENDA_ID },
    });
    const created = calls.outboxCreate[0].data as { operacion: string };
    expect(created.operacion).toBe("CREATE");
  });

  it('should enqueue operacion "UPDATE" when a prior STORE event already exists for this local', async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow(), priorOutboxEvent: { id: BigInt(5) } });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: baseUpdateInput(), now: () => NOW });

    const created = calls.outboxCreate[0].data as { operacion: string };
    expect(created.operacion).toBe("UPDATE");
  });
});

describe("saveTiendaOnlineLocal — return value and occurredAt determinism", () => {
  it("should return { local, eventId } with eventId as a decimal string", async () => {
    const { tx } = makeTx({ existingRow: baseRow(), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    const result = await saveTiendaOnlineLocal({
      negocioId: NEGOCIO_ID,
      tiendaId: TIENDA_ID,
      input: baseUpdateInput(),
      now: () => NOW,
    });

    expect(result.eventId).toBe("1");
    expect(result.local.id).toBe(TIENDA_ID);
  });

  it("should use the injected now() for both the payload's updatedAt and the event's ocurridoAt", async () => {
    const { tx, calls } = makeTx({ existingRow: baseRow(), priorOutboxEvent: null });
    transactionMock.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx));

    await saveTiendaOnlineLocal({ negocioId: NEGOCIO_ID, tiendaId: TIENDA_ID, input: baseUpdateInput(), now: () => NOW });

    const created = calls.outboxCreate[0].data as {
      payload: { updatedAt: string };
      ocurridoAt?: Date;
    };
    expect(created.payload.updatedAt).toBe(NOW.toISOString());
    if (created.ocurridoAt) {
      expect(created.ocurridoAt.toISOString()).toBe(NOW.toISOString());
    }
  });
});

describe("listTiendaOnlineLocales — multi-tenant isolation and ALMACEN inclusion (contract §8.2, §6.1)", () => {
  it("should read with tienda.findMany({ where: { negocioId }, select: TIENDA_ONLINE_LOCAL_SELECT })", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([]);

    await listTiendaOnlineLocales(NEGOCIO_ID);

    expect(tiendaFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ negocioId: NEGOCIO_ID }),
        select: TIENDA_ONLINE_LOCAL_SELECT,
      })
    );
  });

  it("should include an ALMACEN local in the result with publishable: false, not drop it", async () => {
    tiendaFindManyMock.mockResolvedValueOnce([
      baseRow({ id: "tienda-1", tipo: "TIENDA" }),
      baseRow({ id: "almacen-1", nombre: "Depósito Norte", tipo: "ALMACEN" }),
    ]);

    const locales = await listTiendaOnlineLocales(NEGOCIO_ID);

    expect(locales).toHaveLength(2);
    const almacen = locales.find((l) => l.id === "almacen-1");
    expect(almacen).toBeDefined();
    expect(almacen?.publishable).toBe(false);
    const tienda = locales.find((l) => l.id === "tienda-1");
    expect(tienda?.publishable).toBe(true);
  });
});
