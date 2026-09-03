import { z } from "zod";
import {
  QAB_BEARER_VALUE_PATTERN,
  QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH,
  QAB_PROVISIONING_NAME_MAX_LENGTH,
  QAB_PROVISIONING_RESULTS,
  QAB_PROVISIONING_UPSTREAM_CODES,
  QAB_TOKEN_MAX_LENGTH,
  QAB_TOKEN_MIN_LENGTH,
} from "@/constants/qabProvisioning";
import { negocioQabSettingsItemSchema } from "@/schemas/qabNegocio";

/** What cuadrecaja sends. Validated BEFORE going out: an invalid body is not sent. */
export const qabProvisioningRequestSchema = z
  .object({
    externalId: z.string().trim().min(1).max(QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH),
    name: z.string().trim().min(1).max(QAB_PROVISIONING_NAME_MAX_LENGTH).optional(),
  })
  .strict();
export type IQabProvisioningRequest = z.infer<typeof qabProvisioningRequestSchema>;

/**
 * The 201. NOT `.strict()`: QAB may add keys and that must not break cuadrecaja.
 * Zod drops the ones not named, so the resulting object is exactly these four
 * keys - never a surprise.
 */
export const qabProvisioningMintedResponseSchema = z.object({
  externalId: z.string().min(1),
  created: z.boolean(),
  minted: z.literal(true),
  token: z
    .string()
    .min(QAB_TOKEN_MIN_LENGTH)
    .max(QAB_TOKEN_MAX_LENGTH)
    .regex(QAB_BEARER_VALUE_PATTERN),
});

/** The idempotent 200. */
export const qabProvisioningAlreadyMintedResponseSchema = z.object({
  externalId: z.string().min(1),
  created: z.literal(false),
  minted: z.literal(false),
  token: z.null(),
});

/** 200 response of `POST /api/negocio/[id]/qab/credential`. Carries NO token. */
export const negocioQabProvisioningResultSchema = z
  .object({
    result: z.enum(QAB_PROVISIONING_RESULTS),
    createdInQab: z.boolean(),
    settings: negocioQabSettingsItemSchema,
  })
  .strict();
export type INegocioQabProvisioningResult = z.infer<
  typeof negocioQabProvisioningResultSchema
>;

/** Error body of that same route, for any status other than 200. */
export const negocioQabProvisioningErrorSchema = z
  .object({
    error: z.enum([
      "FORBIDDEN",
      "NEGOCIO_NOT_FOUND",
      "PROVISIONING_SECRET_NOT_SET",
      "QAB_API_BASE_URL_NOT_SET",
      "QAB_CONFIG_INVALID",
      "QAB_PROVISIONING_UPSTREAM",
      "QAB_TOKEN_ORPHANED",
    ]),
    qabError: z.enum(QAB_PROVISIONING_UPSTREAM_CODES).nullable(),
    retryable: z.boolean(),
  })
  .strict();
export type INegocioQabProvisioningError = z.infer<
  typeof negocioQabProvisioningErrorSchema
>;
