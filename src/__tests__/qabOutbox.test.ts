import { describe, it, expect } from "vitest";
import {
  qabOutboxEntitySchema,
  qabOutboxOperationSchema,
  outboxEventoCreateSchema,
  outboxEventoSchema,
} from "@/schemas/qabOutbox";
import { QAB_OUTBOX_ENTITIES, QAB_OUTBOX_OPERATIONS } from "@/constants/qab";

/**
 * F-001 — the shape of an OutboxEvento row. The table is born empty and stays empty in this
 * feature: nothing emits events until F-002. What is fixed here is the boundary.
 *
 * Two contract decisions this file guards:
 *
 *  - `entidad` stores the WIRE value, in English: "PRODUCT", never "PRODUCTO". The TypeScript
 *    snippet of the contract writes "PRODUCTO", but it is illustrative; the normative list is
 *    STORE | CATEGORY | PRODUCT | CURRENCY | EXCHANGE_RATE. Storing the wire value is what lets
 *    F-002 serialize without translating.
 *  - `outboxEventoSchema.id` is a STRING, not a bigint. The column is a BigInt autoincrement, and
 *    a raw bigint blows up JSON.stringify. The boundary with the rest of the system is text.
 */

const baseCreate = {
  negocioId: "negocio-1",
  entidad: "PRODUCT",
  entidadId: "producto-1",
  operacion: "UPDATE",
  payload: { storeProductId: "pt-1", price: "880.00" },
};

const baseRow = {
  id: "1",
  negocioId: "negocio-1",
  entidad: "PRODUCT",
  entidadId: "producto-1",
  operacion: "UPDATE",
  ocurridoAt: new Date("2026-09-01T10:00:00.000Z"),
  payload: { storeProductId: "pt-1" },
  intentos: 0,
  procesadoAt: null,
  ultimoError: null,
};

describe("qabOutboxEntitySchema", () => {
  it("should hold exactly the five wire entities of the contract", () => {
    expect([...QAB_OUTBOX_ENTITIES]).toEqual([
      "STORE",
      "CATEGORY",
      "PRODUCT",
      "CURRENCY",
      "EXCHANGE_RATE",
    ]);
  });

  it.each(QAB_OUTBOX_ENTITIES.map((entity) => [entity] as const))(
    "should accept the wire entity %s",
    (entity) => {
      expect(qabOutboxEntitySchema.parse(entity)).toBe(entity);
    }
  );

  it("should reject 'PRODUCTO': the stored value is the wire value, in English", () => {
    expect(qabOutboxEntitySchema.safeParse("PRODUCTO").success).toBe(false);
  });

  it("should reject a lowercase entity", () => {
    expect(qabOutboxEntitySchema.safeParse("product").success).toBe(false);
  });
});

describe("qabOutboxOperationSchema", () => {
  it("should hold exactly the three wire operations of the contract", () => {
    expect([...QAB_OUTBOX_OPERATIONS]).toEqual(["CREATE", "UPDATE", "DELETE"]);
  });

  it.each(QAB_OUTBOX_OPERATIONS.map((operation) => [operation] as const))(
    "should accept the wire operation %s",
    (operation) => {
      expect(qabOutboxOperationSchema.parse(operation)).toBe(operation);
    }
  );

  it("should reject an operation outside the contract", () => {
    expect(qabOutboxOperationSchema.safeParse("UPSERT").success).toBe(false);
  });
});

describe("outboxEventoCreateSchema", () => {
  it("should accept a well formed event without ocurridoAt", () => {
    const parsed = outboxEventoCreateSchema.parse(baseCreate);

    expect(parsed).toMatchObject({
      negocioId: "negocio-1",
      entidad: "PRODUCT",
      entidadId: "producto-1",
      operacion: "UPDATE",
    });
  });

  it("should accept an explicit ocurridoAt", () => {
    const ocurridoAt = new Date("2026-09-01T10:00:00.000Z");

    const parsed = outboxEventoCreateSchema.parse({ ...baseCreate, ocurridoAt });

    expect(parsed.ocurridoAt).toEqual(ocurridoAt);
  });

  it("should reject an ocurridoAt that is an ISO string instead of a Date", () => {
    expect(
      outboxEventoCreateSchema.safeParse({
        ...baseCreate,
        ocurridoAt: "2026-09-01T10:00:00.000Z",
      }).success
    ).toBe(false);
  });

  it("should reject an entity outside the five of the contract", () => {
    expect(
      outboxEventoCreateSchema.safeParse({ ...baseCreate, entidad: "PRODUCTO" }).success
    ).toBe(false);
  });

  it("should reject an operation outside the three of the contract", () => {
    expect(
      outboxEventoCreateSchema.safeParse({ ...baseCreate, operacion: "UPSERT" }).success
    ).toBe(false);
  });

  const missingKeys: Array<[string, Record<string, unknown>]> = [
    ["negocioId", { ...baseCreate, negocioId: undefined }],
    ["entidad", { ...baseCreate, entidad: undefined }],
    ["entidadId", { ...baseCreate, entidadId: undefined }],
    ["operacion", { ...baseCreate, operacion: undefined }],
  ];

  it.each(missingKeys)("should reject an event without %s", (_label, value) => {
    expect(outboxEventoCreateSchema.safeParse(value).success).toBe(false);
  });

  it("should reject a negocioId that is not a string: the event is owned by a business", () => {
    expect(outboxEventoCreateSchema.safeParse({ ...baseCreate, negocioId: 1 }).success).toBe(
      false
    );
  });

  it("should not carry the row-only fields through", () => {
    // `intentos`, `procesadoAt` and `ultimoError` belong to the row, never to what a caller
    // writes: the drainer of F-002 owns them.
    const parsed = outboxEventoCreateSchema.parse({
      ...baseCreate,
      intentos: 99,
      procesadoAt: new Date(),
      ultimoError: "boom",
    });

    expect(parsed).not.toHaveProperty("intentos");
    expect(parsed).not.toHaveProperty("procesadoAt");
    expect(parsed).not.toHaveProperty("ultimoError");
  });
});

describe("outboxEventoSchema", () => {
  it("should accept a pending row", () => {
    const parsed = outboxEventoSchema.parse(baseRow);

    expect(parsed).toMatchObject({
      id: "1",
      negocioId: "negocio-1",
      entidad: "PRODUCT",
      intentos: 0,
      procesadoAt: null,
      ultimoError: null,
    });
  });

  it("should keep id as a string, so no JSON.stringify meets a bigint", () => {
    const parsed = outboxEventoSchema.parse(baseRow);

    expect(typeof parsed.id).toBe("string");
    expect(() => JSON.stringify(parsed)).not.toThrow();
  });

  it("should reject a raw bigint id: the caller converts it with String(row.id)", () => {
    expect(outboxEventoSchema.safeParse({ ...baseRow, id: BigInt(1) }).success).toBe(false);
  });

  it("should accept a processed row", () => {
    const procesadoAt = new Date("2026-09-01T10:05:00.000Z");

    const parsed = outboxEventoSchema.parse({ ...baseRow, procesadoAt, intentos: 1 });

    expect(parsed.procesadoAt).toEqual(procesadoAt);
    expect(parsed.intentos).toBe(1);
  });

  it("should accept a row that recorded its last error", () => {
    const parsed = outboxEventoSchema.parse({
      ...baseRow,
      intentos: 6,
      ultimoError: "503 from QAB",
    });

    expect(parsed.ultimoError).toBe("503 from QAB");
  });

  it("should reject an intentos that is not a number", () => {
    expect(outboxEventoSchema.safeParse({ ...baseRow, intentos: "0" }).success).toBe(false);
  });
});
