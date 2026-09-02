import { Prisma } from "@prisma/client";
import type { PrismaClientLike } from "@/lib/prisma";
import { outboxEventoCreateSchema } from "@/schemas/qabOutbox";
import type { IOutboxEventoCreate } from "@/schemas/qabOutbox";

/** What Prisma writes into the required `payload` Json column. */
type OutboxPayloadInput = Prisma.InputJsonValue | typeof Prisma.JsonNull;

function toPrismaCreateData(input: IOutboxEventoCreate) {
  const parsed = outboxEventoCreateSchema.parse(input);
  const payload: OutboxPayloadInput =
    parsed.payload === undefined
      ? Prisma.JsonNull
      : (parsed.payload as Prisma.InputJsonValue);

  return {
    negocioId: parsed.negocioId,
    entidad: parsed.entidad,
    entidadId: parsed.entidadId,
    operacion: parsed.operacion,
    payload,
    ...(parsed.ocurridoAt ? { ocurridoAt: parsed.ocurridoAt } : {}),
  };
}

/**
 * Inserts one outbox row. Takes the transaction client as its FIRST argument on
 * purpose: the caller has to name the transaction it is joining.
 * Throws `ZodError` when `input` does not satisfy `outboxEventoCreateSchema` —
 * and, being inside the caller's transaction, that also rolls the mutation back,
 * which is exactly what is wanted.
 */
export async function enqueueOutboxEvent(
  tx: PrismaClientLike,
  input: IOutboxEventoCreate,
): Promise<{ id: string }> {
  const created = await tx.outboxEvento.create({
    data: toPrismaCreateData(input),
    select: { id: true },
  });
  // No BigInt ever leaves this module (E-003).
  return { id: created.id.toString() };
}

/** Same, in one statement. `inputs: []` returns `{ ids: [] }` without touching the database. */
export async function enqueueOutboxEvents(
  tx: PrismaClientLike,
  inputs: IOutboxEventoCreate[],
): Promise<{ ids: string[] }> {
  if (inputs.length === 0) return { ids: [] };

  const created = await tx.outboxEvento.createManyAndReturn({
    data: inputs.map(toPrismaCreateData),
    select: { id: true },
  });

  return { ids: created.map((row) => row.id.toString()) };
}
