import type { Prisma } from "@prisma/client";

import { TIENDA_ONLINE_SAVE_AUDIT_LOG } from "@/constants/tiendaOnline";
import { prisma } from "@/lib/prisma";
import type { PrismaClientLike } from "@/lib/prisma";
import { enqueueOutboxEvent } from "@/lib/qab/outboxEnqueue";
import {
  QAB_STORE_ENTITY,
  qabPublishedPayloadFilter,
} from "@/lib/qab/qabStoreOutboxFilters";
import { buildQabStorePayload } from "@/lib/qab/qabStorePayload";
import { readStoreSyncStates } from "@/lib/qab/qabStoreSyncState";
import { collectOpeningHoursIssues } from "@/schemas/qabOpeningHours";
import type {
  IOpeningHours,
  IOpeningHoursIssue,
} from "@/schemas/qabOpeningHours";
import { TipoLocal } from "@/schemas/tienda";
import type {
  IQabStoreSyncState,
  ITiendaOnlineLocal,
  ITiendaOnlineLocalUpdate,
  ITiendaOnlineLocalUpdateResult,
} from "@/schemas/tiendaOnline";

/** Explicit select, never the whole row (ADR 0019). */
export const TIENDA_ONLINE_LOCAL_SELECT = {
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
} satisfies Prisma.TiendaSelect;

export type ITiendaOnlineLocalRow = Prisma.TiendaGetPayload<{
  select: typeof TIENDA_ONLINE_LOCAL_SELECT;
}>;

export class TiendaOnlineNotFoundError extends Error {
  constructor() {
    super("Local not found in this business");
    this.name = "TiendaOnlineNotFoundError";
  }
}

/** The local is not `tipo: "TIENDA"`. Acceptance criterion 2. */
export class TiendaOnlineAlmacenError extends Error {
  constructor() {
    super("A warehouse has no online-store configuration");
    this.name = "TiendaOnlineAlmacenError";
  }
}

/** `horarios` in the body did not validate. Carries the coded issues. */
export class TiendaOnlineOpeningHoursError extends Error {
  readonly issues: IOpeningHoursIssue[];

  constructor(issues: IOpeningHoursIssue[]) {
    super("Opening hours did not validate");
    this.name = "TiendaOnlineOpeningHoursError";
    this.issues = issues;
  }
}

const NO_CALENDAR_SYNC_STATE: IQabStoreSyncState = {
  state: "SYNCED",
  code: null,
  attempts: 0,
  since: null,
};

/** `null` and `undefined` both mean "no calendar configured". */
function hasCalendar(horarios: unknown): boolean {
  return horarios !== null && horarios !== undefined;
}

/**
 * One line per applied PATCH: WHO wrote WHICH local of WHICH business, and
 * nothing else. The payload is deliberately not a parameter, so this function
 * cannot leak a phone number or an address even if a caller passed one.
 */
function recordTiendaOnlineSave(args: {
  usuarioId: string | null;
  tiendaId: string;
  negocioId: string;
}): void {
  console.info(
    `${TIENDA_ONLINE_SAVE_AUDIT_LOG} usuarioId=${args.usuarioId ?? "unknown"} tiendaId=${args.tiendaId} negocioId=${args.negocioId}`,
  );
}

/** PURE. Row projection + its sync state -> what the screen receives. */
export function toTiendaOnlineLocal(
  row: ITiendaOnlineLocalRow,
  syncState: IQabStoreSyncState,
  firstPublishPending: boolean,
): ITiendaOnlineLocal {
  // Read with tolerance: a calendar stored before this feature existed (the
  // column accepted any JSON) asks the merchant to configure it again, it does
  // not take the screen down with a 500.
  const stored = hasCalendar(row.horarios) ? row.horarios : null;
  const issues = stored === null ? [] : collectOpeningHoursIssues(stored);
  const valid = stored !== null && issues.length === 0;

  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo === TipoLocal.ALMACEN ? TipoLocal.ALMACEN : TipoLocal.TIENDA,
    publicarEnTienda: row.publicarEnTienda,
    slug: row.slug,
    slugQab: row.slugQab,
    descripcion: row.descripcion,
    direccion: row.direccion,
    ciudad: row.ciudad,
    provincia: row.provincia,
    latitud: row.latitud,
    longitud: row.longitud,
    telefono: row.telefono,
    whatsapp: row.whatsapp,
    email: row.email,
    horarios: valid ? (stored as IOpeningHours) : null,
    horariosInvalid: stored !== null && !valid,
    horariosIssues: issues,
    motivoDespublicacion: row.motivoDespublicacion,
    publishable: row.tipo === TipoLocal.TIENDA,
    firstPublishPending,
    syncState,
  };
}

/* -------------------------------------------------------------------------- */
/* The two outbox questions. They are NOT the same question (ADR 0035).        */
/* -------------------------------------------------------------------------- */

/**
 * "Has this local ever been PUBLISHED?" - true when at least one STORE event of
 * this local carries `publishToStore: true`. Drives `firstPublishPending`, which
 * is its negation, and therefore the brand question.
 *
 * The filter goes on the event's `payload`, not on the event's existence: every
 * applied PATCH emits, so a plain save with the switch off must NOT count.
 *
 *   payload: { path: ["publishToStore"], equals: true }
 *
 * Verified against PostgreSQL: on a local with ten STORE events the predicate
 * matched the five whose payload said `true` and none of the five that said
 * `false`. No migration, no new column: the outbox already holds the answer.
 */
export async function hasEverPublishedToStore(
  tx: PrismaClientLike,
  params: { negocioId: string; tiendaId: string },
): Promise<boolean> {
  const published = await tx.outboxEvento.findFirst({
    where: {
      negocioId: params.negocioId,
      entidad: QAB_STORE_ENTITY,
      entidadId: params.tiendaId,
      payload: qabPublishedPayloadFilter,
    },
    select: { id: true },
  });

  return published !== null;
}

/**
 * "Does the row already exist on QAB's side?" - true when ANY STORE event of
 * this local has been emitted, published or not. This is the original,
 * unfiltered query, and it is what `operacion` needs: QAB writes the store row
 * with the first event that reaches it, whatever `publishToStore` said.
 *
 * Only ever called when `hasEverPublishedToStore` returned false: a local that
 * has published has necessarily emitted, so `operacion` is "UPDATE" already.
 */
export async function hasAnyStoreEvent(
  tx: PrismaClientLike,
  params: { negocioId: string; tiendaId: string },
): Promise<boolean> {
  const emitted = await tx.outboxEvento.findFirst({
    where: {
      negocioId: params.negocioId,
      entidad: QAB_STORE_ENTITY,
      entidadId: params.tiendaId,
    },
    select: { id: true },
  });

  return emitted !== null;
}

/**
 * Which locals of the business have ever been PUBLISHED. Same predicate as
 * `hasEverPublishedToStore`, batched: `groupBy` returns at most one row per
 * local however long the processed history grows, so this needs no row cap.
 *
 * Deliberately NOT capped with `take`: a cap could drop an old publish and
 * report "never published" for a local that has, which would make the brand
 * question reappear. A cap that returns a wrong answer is worse than no cap.
 */
async function readPublishedTiendaIds(
  negocioId: string,
  tiendaIds: string[],
): Promise<Set<string>> {
  if (tiendaIds.length === 0) return new Set();

  const rows = await prisma.outboxEvento.groupBy({
    by: ["entidadId"],
    where: {
      negocioId,
      entidad: QAB_STORE_ENTITY,
      entidadId: { in: tiendaIds },
      payload: qabPublishedPayloadFilter,
    },
  });

  return new Set(rows.map((row) => row.entidadId));
}

/** Every local of the business, ALMACEN included, ordered by `nombre`. */
export async function listTiendaOnlineLocales(
  negocioId: string,
): Promise<ITiendaOnlineLocal[]> {
  const rows = await prisma.tienda.findMany({
    where: { negocioId },
    select: TIENDA_ONLINE_LOCAL_SELECT,
    orderBy: { nombre: "asc" },
  });

  const tiendaIds = rows.map((row) => row.id);
  const [syncStates, published] = await Promise.all([
    readStoreSyncStates(negocioId, tiendaIds),
    readPublishedTiendaIds(negocioId, tiendaIds),
  ]);

  return rows.map((row) =>
    toTiendaOnlineLocal(
      row,
      syncStates.get(row.id) ?? NO_CALENDAR_SYNC_STATE,
      // Never published means the brand question is still pending.
      !published.has(row.id),
    ),
  );
}

/**
 * Persists the block and enqueues the STORE event in ONE transaction. Returns the
 * local as it ended up plus the id of the row written to OutboxEvento.
 *
 * An event is emitted on EVERY applied PATCH, whether anything changed or not.
 * That is what makes acceptance criterion 5 true without any diffing logic: QAB
 * only rewrites `status` when `publishToStore` differs from what it had, so a
 * routine edit repeating the same value reopens nothing.
 */
export async function saveTiendaOnlineLocal(params: {
  negocioId: string;
  tiendaId: string;
  input: ITiendaOnlineLocalUpdate;
  /**
   * Who is writing. Only used for the audit line, and optional so a caller that
   * has no session (a script, a test) still works — see
   * TIENDA_ONLINE_SAVE_AUDIT_LOG for why the line exists at all.
   */
  usuarioId?: string;
  /** Injected so the emitted `updatedAt` is deterministic in tests. */
  now?: () => Date;
}): Promise<ITiendaOnlineLocalUpdateResult> {
  const { negocioId, tiendaId, input } = params;
  const occurredAt = (params.now ?? (() => new Date()))();

  const { local, eventId } = await prisma.$transaction(async (tx) => {
    // The business filter goes in the `where`, never in a later `if`. `Tienda`
    // has no `@@unique([id, negocioId])`, so `findUnique({ where: { id } })`
    // followed by a comparison is exactly what is forbidden here.
    const existing = await tx.tienda.findFirst({
      where: { id: tiendaId, negocioId },
      select: {
        ...TIENDA_ONLINE_LOCAL_SELECT,
        // `monedaBase` joins `nombre` here for F-006: the STORE payload now
        // carries `baseCurrency`, and the builder reads it from the row.
        negocio: { select: { nombre: true, monedaBase: true } },
      },
    });
    if (!existing) throw new TiendaOnlineNotFoundError();

    // ALWAYS, not only when `publicarEnTienda` is true: a warehouse has no
    // online-store configuration at all, which is the simplest way to satisfy
    // criterion 2 without a branch that depends on the flag.
    if (existing.tipo !== TipoLocal.TIENDA) throw new TiendaOnlineAlmacenError();

    // The schema would already have rejected this. This is the net that
    // guarantees no future caller can bypass it.
    if (input.horarios !== null) {
      const issues = collectOpeningHoursIssues(input.horarios);
      if (issues.length > 0) throw new TiendaOnlineOpeningHoursError(issues);
    }

    const updated = await tx.tienda.update({
      // `negocioId` in the `where` of the WRITE too, not just the read. Prisma's
      // extended `whereUnique` accepts the extra scalar next to the unique `id`
      // and puts it in the SQL `WHERE`, so this filters for real.
      where: { id: tiendaId, negocioId },
      data: {
        publicarEnTienda: input.publicarEnTienda,
        slug: input.slug,
        descripcion: input.descripcion,
        direccion: input.direccion,
        ciudad: input.ciudad,
        provincia: input.provincia,
        latitud: input.latitud,
        longitud: input.longitud,
        telefono: input.telefono,
        whatsapp: input.whatsapp,
        email: input.email,
        horarios: input.horarios ?? null,
        motivoDespublicacion: input.motivoDespublicacion,
      },
      select: TIENDA_ONLINE_LOCAL_SELECT,
    });

    // The two outbox questions, in this order and with the short-circuit
    // (ADR 0035). Both go against `@@index([entidad, entidadId])` and both carry
    // `negocioId` in the `where`. In the normal case - an already published
    // local - this is ONE query.
    const everPublishedBefore = await hasEverPublishedToStore(tx, {
      negocioId,
      tiendaId,
    });
    // Short-circuit: having published implies having emitted.
    const emittedBefore = everPublishedBefore
      ? true
      : await hasAnyStoreEvent(tx, { negocioId, tiendaId });

    const payload = buildQabStorePayload({
      negocioId,
      negocioNombre: existing.negocio.nombre,
      tiendaId: updated.id,
      nombre: updated.nombre,
      monedaBase: existing.negocio.monedaBase,
      publicarEnTienda: updated.publicarEnTienda,
      slug: updated.slug,
      descripcion: updated.descripcion,
      direccion: updated.direccion,
      ciudad: updated.ciudad,
      provincia: updated.provincia,
      latitud: updated.latitud,
      longitud: updated.longitud,
      telefono: updated.telefono,
      whatsapp: updated.whatsapp,
      email: updated.email,
      horarios: updated.horarios,
      motivoDespublicacion: updated.motivoDespublicacion,
      occurredAt,
    });

    const event = await enqueueOutboxEvent(tx, {
      negocioId,
      entidad: QAB_STORE_ENTITY,
      entidadId: tiendaId,
      // `operacion` comes from `emittedBefore`, NEVER from
      // `everPublishedBefore`: they answer two different questions, and
      // collapsing them is what broke acceptance criterion 6.
      operacion: emittedBefore ? "UPDATE" : "CREATE",
      payload,
      // The SAME instant as the payload's `updatedAt`.
      ocurridoAt: occurredAt,
    });

    // The event this PATCH just enqueued closes the brand question only if it
    // actually published. A save with the switch off leaves it open.
    const firstPublishPending = !(
      everPublishedBefore || updated.publicarEnTienda
    );

    return {
      local: toTiendaOnlineLocal(
        updated,
        {
          state: "PENDING",
          code: null,
          attempts: 0,
          since: occurredAt.toISOString(),
        },
        firstPublishPending,
      ),
      eventId: event.id,
    };
  });

  recordTiendaOnlineSave({
    usuarioId: params.usuarioId ?? null,
    tiendaId,
    negocioId,
  });

  return { local, eventId };
}
