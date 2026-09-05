import { z } from "zod";
import { QAB_UNPUBLISH_REASON_MAX_LENGTH } from "@/constants/qab";
import { openingHoursSchema } from "@/schemas/qabOpeningHours";
import { qabCurrencyCodeSchema } from "@/schemas/qabCurrency";

export { openingHoursSchema } from "@/schemas/qabOpeningHours";
export type {
  IOpeningHours,
  IOpeningHoursDay,
  IOpeningHoursIssue,
  IOpeningHoursIssueCode,
  IOpeningHoursWindow,
} from "@/schemas/qabOpeningHours";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 80;

const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

/** URL slug: lowercase, digits and single hyphens. */
export const qabSlugSchema: z.ZodType<string, unknown> = z
  .unknown()
  .transform((input, ctx) => {
    if (
      typeof input !== "string" ||
      input.length < 1 ||
      input.length > SLUG_MAX_LENGTH ||
      !SLUG_PATTERN.test(input)
    ) {
      ctx.addIssue({ code: "custom", message: "Invalid QAB slug" });
      return z.NEVER;
    }
    return input;
  });
export type IQabSlug = z.infer<typeof qabSlugSchema>;

/** The online-store block of a Tienda row. Keys match the Prisma field names. */
export const tiendaOnlineSchema = z.object({
  publicarEnTienda: z.boolean(),
  /** What the merchant asked for. QAB only reads it when CREATING the store. */
  slug: qabSlugSchema.nullable(),
  /** What QAB actually assigned. No local uniqueness: the namespace is QAB's. */
  slugQab: z.string().nullable(),
  descripcion: z.string().nullable(),
  direccion: z.string().nullable(),
  ciudad: z.string().nullable(),
  provincia: z.string().nullable(),
  latitud: z.number().min(LATITUDE_MIN).max(LATITUDE_MAX).nullable(),
  longitud: z.number().min(LONGITUDE_MIN).max(LONGITUDE_MAX).nullable(),
  telefono: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().email().nullable(),
  horarios: openingHoursSchema.nullable(),
  motivoDespublicacion: z
    .string()
    .max(QAB_UNPUBLISH_REASON_MAX_LENGTH)
    .nullable(),
});
export type ITiendaOnline = z.infer<typeof tiendaOnlineSchema>;

/**
 * `payload` of a STORE event, contract v10. STRICT on purpose: a `timezone` key
 * does not parse here, which is what makes acceptance criterion 11 structural
 * instead of a thing to remember.
 *
 * The nine contact fields are REQUIRED and nullable. They are written on the
 * other side with `payload.x ?? null`, so omitting one DELETES the column: the
 * only safe rule is that they cannot be omitted at all.
 *
 * `openingHours` is the opposite: absent leaves the column untouched, so it is
 * `.optional()` and the key is dropped entirely when there is no calendar.
 */
export const qabStorePayloadSchema = z
  .object({
    storeId: z.string().uuid(),
    businessId: z.string().uuid(),
    businessName: z.string().min(1),
    name: z.string().min(1),
    /** Derivation seed, read by QAB only when CREATING. */
    slug: z.string().nullable(),
    description: z.string().nullable(),
    address: z.string().nullable(),
    city: z.string().nullable(),
    province: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
    phone: z.string().nullable(),
    whatsapp: z.string().nullable(),
    email: z.string().nullable(),
    /**
     * `Negocio.monedaBase`. OPTIONAL on purpose: the contract says an absent
     * `baseCurrency` defaults to CUP, and a business whose base code is not
     * exactly QAB_CURRENCY_CODE_LENGTH characters must not take the whole STORE
     * event down with it — the builder drops the key instead.
     */
    baseCurrency: qabCurrencyCodeSchema.optional(),
    openingHours: openingHoursSchema.optional(),
    publishToStore: z.boolean(),
    unpublishReason: z.string().max(QAB_UNPUBLISH_REASON_MAX_LENGTH).nullable(),
    /** ISO 8601 with milliseconds. Anti-stale guard on the other side. */
    updatedAt: z.string().datetime(),
  })
  .strict();
export type IQabStorePayload = z.infer<typeof qabStorePayloadSchema>;

/** Flat, and exactly the projection the transaction reads back plus two extras. */
export const qabStorePayloadInputSchema = z
  .object({
    negocioId: z.string().uuid(),
    negocioNombre: z.string().min(1),
    tiendaId: z.string().uuid(),
    nombre: z.string().min(1),
    /** `Negocio.monedaBase`, RAW. The builder decides whether it can travel. */
    monedaBase: z.string(),
    publicarEnTienda: z.boolean(),
    slug: z.string().nullable(),
    descripcion: z.string().nullable(),
    direccion: z.string().nullable(),
    ciudad: z.string().nullable(),
    provincia: z.string().nullable(),
    latitud: z.number().nullable(),
    longitud: z.number().nullable(),
    telefono: z.string().nullable(),
    whatsapp: z.string().nullable(),
    email: z.string().nullable(),
    /** Raw `Tienda.horarios`. Validated by the builder, not by this schema. */
    horarios: z.unknown(),
    motivoDespublicacion: z.string().nullable(),
    /** Instant of the mutation. Also written to OutboxEvento.ocurridoAt. */
    occurredAt: z.date(),
  })
  .strict();
export type IQabStorePayloadInput = z.infer<typeof qabStorePayloadInputSchema>;
