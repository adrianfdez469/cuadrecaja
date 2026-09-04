import { z } from "zod";
import {
  QAB_ORDER_STATUSES,
  QAB_SLUG_QUERY_MAX_LENGTH,
  QAB_SLUG_UPSTREAM_CODES,
  QAB_STORE_ADDRESS_MAX_LENGTH,
  QAB_STORE_CITY_MAX_LENGTH,
  QAB_STORE_DESCRIPTION_MAX_LENGTH,
  QAB_STORE_EMAIL_MAX_LENGTH,
  QAB_STORE_PHONE_MAX_LENGTH,
  QAB_STORE_PROVINCE_MAX_LENGTH,
  QAB_STORE_SYNC_CODES,
  QAB_STORE_SYNC_STATES,
  QAB_UNPUBLISH_REASON_MAX_LENGTH,
} from "@/constants/qab";
import { TIENDA_ONLINE_API_ERRORS } from "@/constants/tiendaOnline";
import {
  openingHoursIssueSchema,
  openingHoursSchema,
} from "@/schemas/qabOpeningHours";
import { qabSlugSchema } from "@/schemas/qabStore";
import { TipoLocalEnum } from "@/schemas/tienda";

/**
 * Response of `GET /api/tienda-online/estado`.
 * The ONLY endpoint of the module that is not behind the switch: the Drawer of
 * EVERY authenticated user needs it to decide whether the section exists at all.
 */
export const tiendaOnlineEstadoSchema = z
  .object({ tiendaOnlineHabilitada: z.boolean() })
  .strict();
export type ITiendaOnlineEstado = z.infer<typeof tiendaOnlineEstadoSchema>;

/**
 * Response of the two scaffolding GETs of F-004. `z.literal(true)` is the point:
 * these routes are only reachable with the switch on, and the schema says so.
 * F-005 and F-011 extend it with `.extend`; they do not replace it.
 */
export const tiendaOnlineScaffoldSchema = z
  .object({
    negocioId: z.string().uuid(),
    tiendaOnlineHabilitada: z.literal(true),
  })
  .strict();
export type ITiendaOnlineScaffold = z.infer<typeof tiendaOnlineScaffoldSchema>;

/**
 * Body of `PATCH /api/tienda-online/pedidos/[pedidoId]/status`.
 * SHAPE ONLY. Which transitions are legal is F-011's problem, not this schema's:
 * every value of the enum parses here, including nonsensical ones.
 */
export const pedidoEntranteStatusUpdateSchema = z
  .object({ status: z.enum(QAB_ORDER_STATUSES) })
  .strict();
export type IPedidoEntranteStatusUpdate = z.infer<
  typeof pedidoEntranteStatusUpdateSchema
>;

/* -------------------------------------------------------------------------- */
/* F-005 — the configuration screen of one local                               */
/* -------------------------------------------------------------------------- */

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A free-text field of the form. Trims, and turns the EMPTY STRING INTO `null`:
 * a field the merchant clears means «delete it», and `""` is a value on the
 * other side, not a deletion.
 */
function nullableText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === null || value.length === 0 ? null : value));
}

function isEmailOrNull(value: string | null): boolean {
  return value === null || EMAIL_PATTERN.test(value);
}

/** The closed vocabulary the screen is allowed to be told about a failed sync. */
export const qabStoreSyncCodeSchema = z.enum(QAB_STORE_SYNC_CODES);
export type IQabStoreSyncCode = z.infer<typeof qabStoreSyncCodeSchema>;

/** Per-local sync state, derived from OutboxEvento. Closed vocabulary: ADR 0034. */
export const qabStoreSyncStateSchema = z
  .object({
    state: z.enum(QAB_STORE_SYNC_STATES),
    /** null when `state` is SYNCED or PENDING with no previous failure. */
    code: qabStoreSyncCodeSchema.nullable(),
    attempts: z.number().int().min(0),
    /** `ocurridoAt` of the oldest pending event, or null when there is none. */
    since: z.string().datetime().nullable(),
  })
  .strict();
export type IQabStoreSyncState = z.infer<typeof qabStoreSyncStateSchema>;
export type IQabStoreSyncStateName = IQabStoreSyncState["state"];

/** One local as the configuration screen sees it. */
export const tiendaOnlineLocalSchema = z
  .object({
    id: z.string().uuid(),
    nombre: z.string().min(1),
    tipo: TipoLocalEnum,
    publicarEnTienda: z.boolean(),
    slug: z.string().nullable(),
    /** What QAB actually assigned. Read-only here: this feature never writes it. */
    slugQab: z.string().nullable(),
    descripcion: z.string().nullable(),
    direccion: z.string().nullable(),
    ciudad: z.string().nullable(),
    provincia: z.string().nullable(),
    latitud: z.number().nullable(),
    longitud: z.number().nullable(),
    telefono: z.string().nullable(),
    whatsapp: z.string().nullable(),
    email: z.string().nullable(),
    /** null when there is no calendar OR when the stored one does not validate. */
    horarios: openingHoursSchema.nullable(),
    /** true when the stored `horarios` is non-empty and does NOT validate. */
    horariosInvalid: z.boolean(),
    /**
     * The coded rules the STORED calendar breaks, empty when it validates.
     *
     * Additive to the interface contract, and required by the design contract:
     * `horarios` comes back as `null` when it does not validate, so without
     * these the screen could only say «the saved calendar is unusable» and never
     * WHICH of the rules it breaks — which is what acceptance criterion 8 and
     * design criterion 36 ask for. `.default([])` so a payload without the key
     * still parses.
     */
    horariosIssues: z.array(openingHoursIssueSchema).default([]),
    motivoDespublicacion: z
      .string()
      .max(QAB_UNPUBLISH_REASON_MAX_LENGTH)
      .nullable(),
    /** `tipo === "TIENDA"`. An ALMACEN never publishes. */
    publishable: z.boolean(),
    /**
     * No STORE event of this local carries `publishToStore: true`, i.e. it has
     * never been published. Drives the brand question, which is asked ONCE per
     * local. NOT "no event has ever been emitted": every applied PATCH emits, so
     * that would let a plain save consume the question. See ADR 0035.
     */
    firstPublishPending: z.boolean(),
    syncState: qabStoreSyncStateSchema,
  })
  .strict();
export type ITiendaOnlineLocal = z.infer<typeof tiendaOnlineLocalSchema>;

/** Response of GET /api/tienda-online/configuracion. Extends the F-004 scaffold. */
export const tiendaOnlineConfiguracionSchema = tiendaOnlineScaffoldSchema
  .extend({ locales: z.array(tiendaOnlineLocalSchema) })
  .strict();
export type ITiendaOnlineConfiguracion = z.infer<
  typeof tiendaOnlineConfiguracionSchema
>;

/**
 * Body of PATCH /api/tienda-online/configuracion/[tiendaId].
 *
 * FULL REPLACEMENT of the online-store block, not a partial: every key is
 * required, `null` included. It is the same omission rule QAB applies, one step
 * earlier - what you do not send is cleared. See ADR 0032.
 *
 * `slugQab` is absent on purpose: QAB owns it and this feature never writes it.
 */
export const tiendaOnlineLocalUpdateSchema = z
  .object({
    publicarEnTienda: z.boolean(),
    slug: qabSlugSchema.nullable(),
    descripcion: nullableText(QAB_STORE_DESCRIPTION_MAX_LENGTH),
    direccion: nullableText(QAB_STORE_ADDRESS_MAX_LENGTH),
    ciudad: nullableText(QAB_STORE_CITY_MAX_LENGTH),
    provincia: nullableText(QAB_STORE_PROVINCE_MAX_LENGTH),
    latitud: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX).nullable(),
    longitud: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX).nullable(),
    telefono: nullableText(QAB_STORE_PHONE_MAX_LENGTH),
    whatsapp: nullableText(QAB_STORE_PHONE_MAX_LENGTH),
    email: nullableText(QAB_STORE_EMAIL_MAX_LENGTH).refine(isEmailOrNull),
    horarios: openingHoursSchema.nullable(),
    motivoDespublicacion: nullableText(QAB_UNPUBLISH_REASON_MAX_LENGTH),
  })
  .strict();
export type ITiendaOnlineLocalUpdate = z.infer<
  typeof tiendaOnlineLocalUpdateSchema
>;

/** Response of the PATCH. `eventId` is the OutboxEvento id, as a decimal string. */
export const tiendaOnlineLocalUpdateResultSchema = z
  .object({ local: tiendaOnlineLocalSchema, eventId: z.string().min(1) })
  .strict();
export type ITiendaOnlineLocalUpdateResult = z.infer<
  typeof tiendaOnlineLocalUpdateResultSchema
>;

/**
 * Query of GET /api/tienda-online/slug-availability.
 *
 * `slug` and `name` are capped but NOT format-checked: an unusable candidate has
 * to reach QAB so it can answer `reason: "invalid"`. The cap is what stops an
 * unbounded string from leaving cuadrecaja (security-guardian, F-005).
 */
export const tiendaOnlineSlugQuerySchema = z
  .object({
    slug: z.string().trim().min(1).max(QAB_SLUG_QUERY_MAX_LENGTH).optional(),
    name: z.string().trim().min(1).max(QAB_SLUG_QUERY_MAX_LENGTH).optional(),
    tiendaId: z.string().uuid().optional(),
  })
  .strict()
  .refine((query) => query.slug !== undefined || query.name !== undefined);
export type ITiendaOnlineSlugQuery = z.infer<typeof tiendaOnlineSlugQuerySchema>;

/** Response of GET /api/tienda-online/slug-availability. `reserving` is NOT re-exposed. */
export const tiendaOnlineSlugForecastSchema = z
  .object({
    candidate: z.string(),
    available: z.boolean(),
    /** OPEN string, not an enum: a seventh value must not break the screen (ADR 0033). */
    reason: z.string(),
    resolvedSlug: z.string(),
    url: z.string(),
    storeKnown: z.boolean(),
  })
  .strict();
export type ITiendaOnlineSlugForecast = z.infer<
  typeof tiendaOnlineSlugForecastSchema
>;

/** Body of every 502 of the slug route. Same shape F-003 established. */
export const tiendaOnlineSlugErrorSchema = z
  .object({
    error: z.literal(TIENDA_ONLINE_API_ERRORS.slugUpstream),
    qabError: z.enum(QAB_SLUG_UPSTREAM_CODES),
    retryable: z.boolean(),
  })
  .strict();
export type ITiendaOnlineSlugError = z.infer<typeof tiendaOnlineSlugErrorSchema>;
