export const REFERRAL_PROMO_CODE_PREFIX = 'PRM';
export const REFERRAL_PROMO_CODE_SEPARATOR = '-';
export const REFERRAL_PROMO_CODE_RANDOM_LENGTH = 4;
export const REFERRAL_PROMO_CODE_REGEX = /^PRM-[A-Z0-9]{4}$/;

/** Respuestas neutrales para endpoints públicos (anti-enumeración de correos). */
export const REFERRAL_PUBLIC_MESSAGES = {
  activationRequestSent:
    'Si el correo es válido, te enviamos un enlace de activación.',
  magicLinkSentIfAccount:
    'Si existe una cuenta activa, enviamos un enlace de acceso.',
} as const;

export const REFERRAL_TOKEN_TTL = {
  activationMinutes: 60 * 24,
  magicLoginMinutes: 15,
} as const;

export const PROMOTER_STATUS = {
  pendingEmailVerification: 'PENDING_EMAIL_VERIFICATION',
  active: 'ACTIVE',
  inactive: 'INACTIVE',
} as const;

export const AUTH_TOKEN_TYPE = {
  activation: 'ACTIVATION',
  magicLogin: 'MAGIC_LOGIN',
} as const;

export const REFERRAL_STATUS = {
  captured: 'CAPTURED',
  pendingFirstPayment: 'PENDING_FIRST_PAYMENT',
  qualified: 'QUALIFIED',
  liquidationPending: 'LIQUIDATION_PENDING',
  liquidatedManually: 'LIQUIDATED_MANUALLY',
  rejectedFraud: 'REJECTED_FRAUD',
  cancelledUnpaidDeleted: 'CANCELLED_UNPAID_DELETED',
} as const;

export const REFERRAL_LIQUIDATION_STATUS = {
  pending: 'PENDING',
  liquidated: 'LIQUIDATED',
} as const;

export const REFERRAL_EVENT_TYPE = {
  promoter: 'PROMOTER',
  referral: 'REFERRAL',
  liquidation: 'LIQUIDATION',
} as const;

export const REFERRAL_STATUS_LABELS: Record<string, string> = {
  [REFERRAL_STATUS.captured]: 'Capturado',
  [REFERRAL_STATUS.pendingFirstPayment]: 'Pendiente de primer pago',
  [REFERRAL_STATUS.qualified]: 'Calificado',
  [REFERRAL_STATUS.liquidationPending]: 'Pendiente de liquidación',
  [REFERRAL_STATUS.liquidatedManually]: 'Liquidado',
  [REFERRAL_STATUS.rejectedFraud]: 'Rechazado por fraude',
  [REFERRAL_STATUS.cancelledUnpaidDeleted]: 'Cancelado (sin pago)',
};
