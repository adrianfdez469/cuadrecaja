import { Prisma, ReferralStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { IAdminPromotersQuery, IAdminReferralsQuery } from '@/schemas/referral';

const LIST_LIMIT = 300;

export async function listPromotersForAdmin(query: IAdminPromotersQuery) {
  const where: Prisma.PromoterWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.q && query.q.trim()) {
    const term = query.q.trim();
    where.OR = [
      { email: { contains: term, mode: 'insensitive' } },
      { fullName: { contains: term, mode: 'insensitive' } },
      { promoCode: { contains: term.toUpperCase(), mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.promoter.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      fullName: true,
      email: true,
      promoCode: true,
      status: true,
      activatedAt: true,
      createdAt: true,
      _count: { select: { referrals: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    email: r.email,
    promoCode: r.promoCode,
    status: r.status,
    activatedAt: r.activatedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    referralsCount: r._count.referrals,
  }));
}

export async function listReferralsForAdmin(query: IAdminReferralsQuery) {
  const where: Prisma.ReferralWhereInput = {};

  if (query.status && query.status.trim()) {
    where.status = query.status as ReferralStatus;
  }
  if (query.promoterId) {
    where.promoterId = query.promoterId;
  }
  if (query.planId) {
    where.firstPaidPlanId = query.planId;
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = query.from;
    if (query.to) where.createdAt.lte = query.to;
  }

  const rows = await prisma.referral.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    include: {
      promoter: { select: { id: true, fullName: true, email: true, promoCode: true } },
      newBusiness: { select: { id: true, nombre: true } },
      firstPaidPlan: { select: { id: true, nombre: true } },
      liquidation: {
        select: {
          id: true,
          status: true,
          liquidatedAt: true,
          paidAmount: true,
          paymentMethod: true,
          note: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    firstPaidAt: r.firstPaidAt?.toISOString() ?? null,
    fraudReason: r.fraudReason,
    newBusinessDiscountSnapshot: r.newBusinessDiscountSnapshot,
    promoterRewardSnapshot: r.promoterRewardSnapshot,
    promoter: r.promoter,
    newBusiness: r.newBusiness,
    firstPaidPlan: r.firstPaidPlan,
    liquidation: r.liquidation
      ? {
          ...r.liquidation,
          liquidatedAt: r.liquidation.liquidatedAt?.toISOString() ?? null,
        }
      : null,
  }));
}

export async function listReferralEventsForAdmin(referralId: string) {
  const logs = await prisma.referralEventLog.findMany({
    where: { referralId },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      id: true,
      entityType: true,
      eventType: true,
      payload: true,
      actorUserId: true,
      createdAt: true,
    },
  });

  return logs.map((l) => ({
    id: l.id,
    entityType: l.entityType,
    eventType: l.eventType,
    payload: l.payload,
    actorUserId: l.actorUserId,
    createdAt: l.createdAt.toISOString(),
  }));
}
