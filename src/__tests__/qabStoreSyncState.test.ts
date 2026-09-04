import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  QAB_OUTBOX_MAX_ATTEMPTS,
  QAB_STORE_SYNC_STATE_MAX_ROWS,
  QAB_STORE_SYNC_CODES,
} from "@/constants/qab";

/**
 * F-005 — `src/lib/qab/qabStoreSyncState.ts` (contract §5.2). `normalizeOutboxErrorCode` and
 * `buildStoreSyncState` are PURE; `readStoreSyncStates` touches Prisma, so `@/lib/prisma` is
 * mocked (external dependency).
 *
 * `normalizeOutboxErrorCode` exists so a raw error string never reaches the screen (ADR 0034) —
 * every test that is NOT one of the four documented prefixes/literals must come back as
 * "UNKNOWN", never as the raw text.
 */

const outboxFindManyMock = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/prisma", () => ({
  prisma: { outboxEvento: { findMany: outboxFindManyMock } },
}));

const { normalizeOutboxErrorCode, buildStoreSyncState, readStoreSyncStates } = await import(
  "@/lib/qab/qabStoreSyncState"
);

beforeEach(() => {
  outboxFindManyMock.mockReset().mockResolvedValue([]);
});

describe("normalizeOutboxErrorCode", () => {
  it("should return null for null (no error at all)", () => {
    expect(normalizeOutboxErrorCode(null)).toBeNull();
  });

  it('should recognise the literal "QAB_TOKEN_MISSING" as TOKEN_MISSING', () => {
    expect(normalizeOutboxErrorCode("QAB_TOKEN_MISSING")).toBe("TOKEN_MISSING");
  });

  it('should recognise a "TRANSPORT:..." prefix as TRANSPORT', () => {
    expect(normalizeOutboxErrorCode("TRANSPORT:ECONNREFUSED")).toBe("TRANSPORT");
  });

  it('should recognise "EVENT:STORE_OPENING_HOURS_INVALID" as STORE_OPENING_HOURS_INVALID', () => {
    expect(normalizeOutboxErrorCode("EVENT:STORE_OPENING_HOURS_INVALID")).toBe(
      "STORE_OPENING_HOURS_INVALID"
    );
  });

  it('should recognise "EVENT:STORE_TIMEZONE_INVALID" as STORE_TIMEZONE_INVALID', () => {
    expect(normalizeOutboxErrorCode("EVENT:STORE_TIMEZONE_INVALID")).toBe("STORE_TIMEZONE_INVALID");
  });

  it('should map an "HTTP:<status>:<body>" message to SOME member of the closed QAB_STORE_SYNC_CODES vocabulary', () => {
    // The contract only promises the SHAPE is recognised ("HTTP:<status>:<body>"), not a
    // specific status -> code table (that table exists only for the slug forecast client,
    // which the contract spells out explicitly in §5.4 — this function has no such table
    // written down). What must hold is the closed-vocabulary guarantee itself.
    const code = normalizeOutboxErrorCode("HTTP:401:Unauthorized");
    expect(code).not.toBeNull();
    expect([...QAB_STORE_SYNC_CODES]).toContain(code);
  });

  it("should NEVER let an unrecognised message's raw text leak through: it always comes back as UNKNOWN", () => {
    const raw = "EVENT:this free-text message must never be echoed back to the screen";
    const code = normalizeOutboxErrorCode(raw);

    expect(code).toBe("UNKNOWN");
    expect(code).not.toContain("echoed");
  });

  it("should map a completely foreign string to UNKNOWN", () => {
    expect(normalizeOutboxErrorCode("boom")).toBe("UNKNOWN");
  });

  it("should map MISSING_IN_RESPONSE (planOutboxAck's own literal) to UNKNOWN", () => {
    expect(normalizeOutboxErrorCode("MISSING_IN_RESPONSE")).toBe("UNKNOWN");
  });
});

describe("buildStoreSyncState", () => {
  it("should return SYNCED with everything at its zero value for no rows", () => {
    expect(buildStoreSyncState([])).toEqual({ state: "SYNCED", code: null, attempts: 0, since: null });
  });

  it("should return PENDING with a null code when rows exist but none has an error yet", () => {
    const result = buildStoreSyncState([
      { ocurridoAt: new Date("2026-09-01T00:00:00.000Z"), intentos: 0, ultimoError: null },
    ]);

    expect(result.state).toBe("PENDING");
    expect(result.code).toBeNull();
  });

  it("should return FAILED when the most recent errored row has fewer attempts than QAB_OUTBOX_MAX_ATTEMPTS", () => {
    const result = buildStoreSyncState([
      {
        ocurridoAt: new Date("2026-09-01T00:00:00.000Z"),
        intentos: QAB_OUTBOX_MAX_ATTEMPTS - 1,
        ultimoError: "EVENT:STORE_OPENING_HOURS_INVALID",
      },
    ]);

    expect(result.state).toBe("FAILED");
    expect(result.code).toBe("STORE_OPENING_HOURS_INVALID");
    expect(result.attempts).toBe(QAB_OUTBOX_MAX_ATTEMPTS - 1);
  });

  it("should return BLOCKED once attempts reach QAB_OUTBOX_MAX_ATTEMPTS", () => {
    const result = buildStoreSyncState([
      {
        ocurridoAt: new Date("2026-09-01T00:00:00.000Z"),
        intentos: QAB_OUTBOX_MAX_ATTEMPTS,
        ultimoError: "TRANSPORT:timeout",
      },
    ]);

    expect(result.state).toBe("BLOCKED");
    expect(result.attempts).toBe(QAB_OUTBOX_MAX_ATTEMPTS);
  });

  it("should take code and attempts from the MOST RECENT errored row, regardless of input array order", () => {
    // Two rows, given OUT of chronological order on purpose: the function must sort by
    // ocurridoAt itself, not trust the array's order (E-008: with only one row, or with rows
    // already sorted, this distinction would be invisible).
    const older = {
      ocurridoAt: new Date("2026-09-01T00:00:00.000Z"),
      intentos: 1,
      ultimoError: "EVENT:STORE_OPENING_HOURS_INVALID",
    };
    const newer = {
      ocurridoAt: new Date("2026-09-02T00:00:00.000Z"),
      intentos: 3,
      ultimoError: "TRANSPORT:ECONNREFUSED",
    };

    const result = buildStoreSyncState([newer, older]);

    expect(result.code).toBe("TRANSPORT");
    expect(result.attempts).toBe(3);
  });

  it("should set since to the ocurridoAt of the OLDEST pending row, as an ISO string", () => {
    const oldest = new Date("2026-08-30T00:00:00.000Z");
    const middle = new Date("2026-09-01T00:00:00.000Z");
    const result = buildStoreSyncState([
      { ocurridoAt: middle, intentos: 0, ultimoError: null },
      { ocurridoAt: oldest, intentos: 0, ultimoError: null },
    ]);

    expect(result.since).toBe(oldest.toISOString());
  });
});

describe("readStoreSyncStates", () => {
  it("should query outboxEvento filtered by negocioId, entidad STORE, entidadId in tiendaIds, and unprocessed rows only", async () => {
    outboxFindManyMock.mockResolvedValueOnce([]);

    await readStoreSyncStates("negocio-1", ["tienda-1", "tienda-2"]);

    expect(outboxFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          negocioId: "negocio-1",
          entidad: "STORE",
          entidadId: { in: ["tienda-1", "tienda-2"] },
          procesadoAt: null,
        }),
      })
    );
  });

  it(`should bound the query with take: ${QAB_STORE_SYNC_STATE_MAX_ROWS}`, async () => {
    outboxFindManyMock.mockResolvedValueOnce([]);

    await readStoreSyncStates("negocio-1", ["tienda-1"]);

    expect(outboxFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ take: QAB_STORE_SYNC_STATE_MAX_ROWS })
    );
  });

  it("should return a Map with the built sync state for a local that has pending rows", async () => {
    outboxFindManyMock.mockResolvedValueOnce([
      {
        entidadId: "tienda-1",
        ocurridoAt: new Date("2026-09-01T00:00:00.000Z"),
        intentos: 1,
        ultimoError: "EVENT:STORE_OPENING_HOURS_INVALID",
      },
    ]);

    const result = await readStoreSyncStates("negocio-1", ["tienda-1"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.get("tienda-1")).toMatchObject({ state: "FAILED", code: "STORE_OPENING_HOURS_INVALID" });
  });

  it("should never mix the pending rows of two different locals into the same state", () => {
    // Two locals, one FAILED and one merely PENDING: if the implementation grouped by
    // something other than entidadId, one local's error would bleed into the other's state.
    const rowsA = [
      { entidadId: "tienda-a", ocurridoAt: new Date("2026-09-01T00:00:00.000Z"), intentos: 1, ultimoError: "TRANSPORT:x" },
    ];
    const rowsB = [
      { entidadId: "tienda-b", ocurridoAt: new Date("2026-09-01T00:00:00.000Z"), intentos: 0, ultimoError: null },
    ];

    const stateA = buildStoreSyncState(rowsA);
    const stateB = buildStoreSyncState(rowsB);

    expect(stateA.state).toBe("FAILED");
    expect(stateB.state).toBe("PENDING");
  });
});
