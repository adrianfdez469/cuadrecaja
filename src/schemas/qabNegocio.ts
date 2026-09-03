import { z } from "zod";
import {
  QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS,
  QAB_BEARER_VALUE_PATTERN,
  QAB_TOKEN_MAX_LENGTH,
  QAB_TOKEN_MIN_LENGTH,
} from "@/constants/qabProvisioning";

/**
 * The QAB block of a Negocio, as it may be shown. The token is NOT here and
 * never will be: `qabTokenConfigurado` is derived server-side from
 * `qabToken !== null`. See ADR 0006 and ADR 0024.
 *
 * Invariant checkable with a grep: no schema in src/schemas/ contains the key
 * `qabToken`.
 *
 * `.strict()` is what stops a fourth key from slipping in unnoticed; the key
 * assertion in the test suite is what makes criterion 16 fail when someone adds
 * one on purpose. See ADR 0025.
 */
export const negocioQabSettingsSchema = z
  .object({
    tiendaOnlineHabilitada: z.boolean(),
    qabTokenConfigurado: z.boolean(),
    qabTokenActualizadoAt: z.date().nullable(),
  })
  .strict();
export type INegocioQabSettings = z.infer<typeof negocioQabSettingsSchema>;

/**
 * What travels over HTTP: the same thing plus the business id, with the date
 * coerced because on the wire it is an ISO string. DERIVED from the schema above
 * with `.extend` so it cannot carry keys that one does not have.
 */
export const negocioQabSettingsItemSchema = negocioQabSettingsSchema
  .extend({
    negocioId: z.string().uuid(),
    qabTokenActualizadoAt: z.coerce.date().nullable(),
  })
  .strict();
export type INegocioQabSettingsItem = z.infer<typeof negocioQabSettingsItemSchema>;

export const qabAutoProvisioningUnavailableReasonSchema = z.enum(
  QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS,
);
export type IQabAutoProvisioningUnavailableReason = z.infer<
  typeof qabAutoProvisioningUnavailableReasonSchema
>;

/** Response of `GET /api/negocio/qab`. */
export const negociosQabSettingsListSchema = z
  .object({
    autoProvisioningAvailable: z.boolean(),
    autoProvisioningUnavailableReason:
      qabAutoProvisioningUnavailableReasonSchema.nullable(),
    negocios: z.array(negocioQabSettingsItemSchema),
  })
  .strict();
export type INegociosQabSettingsList = z.infer<typeof negociosQabSettingsListSchema>;

/** Body of `PATCH /api/negocio/[id]/qab`. */
export const negocioTiendaOnlineToggleSchema = z
  .object({ tiendaOnlineHabilitada: z.boolean() })
  .strict();
export type INegocioTiendaOnlineToggle = z.infer<typeof negocioTiendaOnlineToggleSchema>;

/**
 * Body of `PUT /api/negocio/[id]/qab/token` - the rescue path.
 * The regex is not cosmetic: this value ends up in an `Authorization` header of
 * the drain, and a newline there is header injection.
 *
 * WARNING: no route using this schema ever returns or logs `error.issues`: a Zod
 * issue can drag along the value that caused it.
 */
export const qabTokenPasteSchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(QAB_TOKEN_MIN_LENGTH)
      .max(QAB_TOKEN_MAX_LENGTH)
      .regex(QAB_BEARER_VALUE_PATTERN),
  })
  .strict();
export type IQabTokenPaste = z.infer<typeof qabTokenPasteSchema>;
