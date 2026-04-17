import { z } from 'zod';
import { REFERRAL_PROMO_CODE_REGEX } from '@/constants/referrals';

export const promoterApplySchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre es obligatorio'),
  email: z.string().trim().email('El correo no es válido').toLowerCase(),
});

export const landingContactFormSchema = z.object({
  nombre: z.string().trim().min(1, 'Nombre requerido'),
  nombreNegocio: z.string().trim().min(1, 'Nombre del negocio requerido'),
  correo: z.string().trim().email('El correo no es válido').toLowerCase(),
  telefono: z.string().optional().default(''),
  numeroLocales: z.coerce.number().int().min(1).max(19),
  mensaje: z.string().optional().default(''),
  referido: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .default('')
    .refine((val) => !val || REFERRAL_PROMO_CODE_REGEX.test(val), {
      message: 'El código de referido no tiene un formato válido.',
    }),
});

export const activationTokenPayloadSchema = z.object({
  nombre: z.string().trim().min(1),
  nombreNegocio: z.string().trim().min(1),
  correo: z.string().trim().email().toLowerCase(),
  telefono: z.string().optional().default(''),
  numeroLocales: z.union([z.number().int(), z.string()]).optional(),
  referido: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .default('')
    .refine((val) => !val || REFERRAL_PROMO_CODE_REGEX.test(val), {
      message: 'El código de referido no tiene un formato válido.',
    }),
});

export const promoterActivationTokenSchema = z.object({
  type: z.literal('ACTIVATION'),
  fullName: z.string().min(2),
  email: z.string().email().toLowerCase(),
});

export const promoterActivateRequestSchema = z.object({
  token: z.string().trim().min(1, 'Token requerido'),
});

export const promoterMagicLinkRequestSchema = z.object({
  email: z.string().trim().email('El correo no es válido').toLowerCase(),
});

export const promoterMagicLinkTokenSchema = z.object({
  type: z.literal('MAGIC_LOGIN'),
  email: z.string().email().toLowerCase(),
});

export const registerFirstPaymentSchema = z.object({
  planId: z.string().uuid('Plan inválido'),
  paidAt: z.coerce.date().optional(),
  paymentAmount: z.number().nonnegative().optional(),
});

export const adminPromotersQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING_EMAIL_VERIFICATION']).optional(),
});

export const adminReferralsQuerySchema = z.object({
  status: z.string().trim().optional(),
  promoterId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const adminLiquidateReferralSchema = z.object({
  liquidatedAt: z.coerce.date().optional(),
  paidAmount: z.number().nonnegative().optional(),
  paymentMethod: z.string().trim().max(120).optional(),
  note: z.string().trim().max(2000).optional(),
});

/** Regla de recompensa por plan (primer pago / calificación de referido). */
export const adminUpsertReferralRewardRuleBodySchema = z.object({
  discountForNewBusiness: z.number().min(0, 'El descuento no puede ser negativo'),
  rewardForPromoter: z.number().min(0, 'La recompensa no puede ser negativa'),
  isActive: z.boolean(),
});

export type IPromoterApplyInput = z.infer<typeof promoterApplySchema>;
export type IPromoterActivationToken = z.infer<typeof promoterActivationTokenSchema>;
export type IPromoterActivateRequest = z.infer<typeof promoterActivateRequestSchema>;
export type IPromoterMagicLinkRequest = z.infer<typeof promoterMagicLinkRequestSchema>;
export type IPromoterMagicLinkToken = z.infer<typeof promoterMagicLinkTokenSchema>;
export type ILandingContactFormInput = z.infer<typeof landingContactFormSchema>;
export type IActivationTokenPayload = z.infer<typeof activationTokenPayloadSchema>;
export type IRegisterFirstPaymentInput = z.infer<typeof registerFirstPaymentSchema>;
export type IAdminPromotersQuery = z.infer<typeof adminPromotersQuerySchema>;
export type IAdminReferralsQuery = z.infer<typeof adminReferralsQuerySchema>;
export type IAdminLiquidateReferralInput = z.infer<typeof adminLiquidateReferralSchema>;
export type IAdminUpsertReferralRewardRuleBody = z.infer<typeof adminUpsertReferralRewardRuleBodySchema>;
