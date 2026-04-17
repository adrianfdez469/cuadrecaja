import axiosClient from '@/lib/axiosClient';
import type { IAdminUpsertReferralRewardRuleBody } from '@/schemas/referral';

export interface IAdminPromoterRow {
  id: string;
  fullName: string;
  email: string;
  promoCode: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  referralsCount: number;
}

export interface IAdminReferralRow {
  id: string;
  status: string;
  createdAt: string;
  firstPaidAt: string | null;
  fraudReason: string | null;
  newBusinessDiscountSnapshot: number | null;
  promoterRewardSnapshot: number | null;
  promoter: { id: string; fullName: string; email: string; promoCode: string };
  newBusiness: { id: string; nombre: string } | null;
  firstPaidPlan: { id: string; nombre: string } | null;
  liquidation: {
    id: string;
    status: string;
    liquidatedAt: string | null;
    paidAmount: number | null;
    paymentMethod: string | null;
    note: string | null;
  } | null;
}

export interface IReferralEventRow {
  id: string;
  entityType: string;
  eventType: string;
  payload: unknown;
  actorUserId: string | null;
  createdAt: string;
}

export async function fetchAdminPromoters(params?: { q?: string; status?: string }) {
  const { data } = await axiosClient.get<{ ok: boolean; items: IAdminPromoterRow[] }>(
    '/api/admin/referrals/promoters',
    { params }
  );
  return data.items;
}

export async function fetchAdminReferrals(params?: {
  status?: string;
  promoterId?: string;
  planId?: string;
  from?: string;
  to?: string;
}) {
  const { data } = await axiosClient.get<{ ok: boolean; items: IAdminReferralRow[] }>(
    '/api/admin/referrals',
    { params }
  );
  return data.items;
}

export async function fetchReferralEvents(referralId: string) {
  const { data } = await axiosClient.get<{ ok: boolean; items: IReferralEventRow[] }>(
    `/api/admin/referrals/${referralId}/events`
  );
  return data.items;
}

export async function liquidateReferral(
  referralId: string,
  body: {
    liquidatedAt?: string;
    paidAmount?: number;
    paymentMethod?: string;
    note?: string;
  }
) {
  const { data } = await axiosClient.patch<{ ok: boolean; message?: string }>(
    `/api/admin/referrals/${referralId}/liquidate`,
    body
  );
  return data;
}

export interface IRegisterFirstPaymentApiResult {
  businessId: string;
  hasReferral: boolean;
  referralId: string | null;
  referralStatus: string | null;
  qualifiedNow: boolean;
  alreadyQualified: boolean;
}

export interface IReferralRewardRulePlanRow {
  planId: string;
  planNombre: string;
  planActivo: boolean;
  rule: {
    id: string;
    discountForNewBusiness: number;
    rewardForPromoter: number;
    isActive: boolean;
  } | null;
}

export async function fetchReferralRewardRulesByPlan(): Promise<IReferralRewardRulePlanRow[]> {
  const { data } = await axiosClient.get<{ ok: boolean; items: IReferralRewardRulePlanRow[] }>(
    '/api/admin/referral-reward-rules'
  );
  return data.items;
}

export async function upsertReferralRewardRuleForPlan(planId: string, body: IAdminUpsertReferralRewardRuleBody) {
  const { data } = await axiosClient.put<{ ok: boolean; message?: string }>(
    `/api/admin/referral-reward-rules/${planId}`,
    body
  );
  return data;
}

export async function registerFirstPaymentForNegocio(
  negocioId: string,
  body: {
    planId: string;
    paidAt?: string;
    paymentAmount?: number;
  }
) {
  const { data } = await axiosClient.post<{
    ok: boolean;
    message?: string;
    result?: IRegisterFirstPaymentApiResult;
  }>(`/api/referrals/register-first-payment/${negocioId}`, body);
  return data;
}
