import { REFERRAL_PROMO_CODE_REGEX } from '@/constants/referrals';

export function isValidReferralPromoCode(value: string | undefined | null): boolean {
  const trimmed = value?.trim().toUpperCase() ?? '';
  if (!trimmed) {
    return true;
  }
  return REFERRAL_PROMO_CODE_REGEX.test(trimmed);
}
