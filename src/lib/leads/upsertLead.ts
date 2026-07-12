import { LeadEstado, LeadFuente, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface IUpsertLeadInput {
  nombre: string;
  email: string;
  telefono?: string | null;
  fuente: LeadFuente;
  negocioNombre?: string | null;
  notas?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}

function mergeMetadata(
  existing: Prisma.JsonValue | null | undefined,
  incoming: Prisma.InputJsonValue | null | undefined
): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (incoming === undefined) {
    return undefined;
  }
  if (incoming === null) {
    return Prisma.JsonNull;
  }

  const existingObj =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, Prisma.JsonValue>)
      : {};
  const incomingObj =
    incoming && typeof incoming === 'object' && !Array.isArray(incoming)
      ? (incoming as Record<string, Prisma.JsonValue>)
      : null;

  if (!incomingObj) {
    return incoming;
  }

  return { ...existingObj, ...incomingObj };
}

/**
 * Crea o actualiza un Lead por email.
 * En update: refresca nombre/fuente/negocioNombre/teléfono/notas/metadata;
 * no pisa `estado` si ya avanzó más allá de NUEVO.
 */
export async function upsertLead(input: IUpsertLeadInput) {
  const email = input.email.trim().toLowerCase();
  if (!email) {
    throw new Error('upsertLead: email es requerido');
  }

  const existing = await prisma.lead.findUnique({ where: { email } });

  if (!existing) {
    return prisma.lead.create({
      data: {
        nombre: input.nombre,
        email,
        telefono: input.telefono ?? null,
        fuente: input.fuente,
        estado: LeadEstado.NUEVO,
        negocioNombre: input.negocioNombre ?? null,
        notas: input.notas ?? null,
        metadata: input.metadata ?? undefined,
      },
    });
  }

  const metadata = mergeMetadata(existing.metadata, input.metadata);

  return prisma.lead.update({
    where: { email },
    data: {
      nombre: input.nombre,
      fuente: input.fuente,
      ...(input.telefono !== undefined ? { telefono: input.telefono } : {}),
      ...(input.negocioNombre !== undefined
        ? { negocioNombre: input.negocioNombre }
        : {}),
      ...(input.notas !== undefined ? { notas: input.notas } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      // No actualizar estado si ya no es NUEVO
    },
  });
}
