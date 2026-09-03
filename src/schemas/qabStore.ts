import { z } from "zod";
import { QAB_UNPUBLISH_REASON_MAX_LENGTH } from "@/constants/qab";

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

/**
 * OPAQUE ON PURPOSE. The contract declares openingHours as Json? and does NOT
 * publish its shape. F-005 replaces this once QAB publishes it.
 * Do NOT invent a shape here.
 */
export const openingHoursSchema = z.unknown();
export type IOpeningHours = z.infer<typeof openingHoursSchema>;

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
  horarios: openingHoursSchema,
  motivoDespublicacion: z
    .string()
    .max(QAB_UNPUBLISH_REASON_MAX_LENGTH)
    .nullable(),
});
export type ITiendaOnline = z.infer<typeof tiendaOnlineSchema>;
