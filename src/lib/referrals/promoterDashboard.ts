import { prisma } from '@/lib/prisma';
import { REFERRAL_STATUS, REFERRAL_STATUS_LABELS } from '@/constants/referrals';

export interface IPromoterDashboardReferralRow {
  id: string;
  businessName: string;
  /** Vacío si el negocio ya fue eliminado (FK en null). */
  businessId: string;
  status: string;
  statusLabel: string;
  createdAt: string;
  firstPaidAt: string | null;
  planNombre: string | null;
  discountSnapshot: number | null;
  rewardSnapshot: number | null;
  fraudReason: string | null;
  liquidationStatus: string | null;
}

export interface IPromoterDashboardData {
  promoter: {
    id: string;
    fullName: string;
    email: string;
    promoCode: string;
  };
  stats: {
    capturados: number;
    calificados: number;
    pendientesLiquidacion: number;
    liquidados: number;
    rechazadosFraude: number;
    cancelados: number;
  };
  referrals: IPromoterDashboardReferralRow[];
}

function labelForStatus(status: string): string {
  return REFERRAL_STATUS_LABELS[status] ?? status;
}

const PENDING_PAYMENT = new Set<string>([
  REFERRAL_STATUS.captured,
  REFERRAL_STATUS.pendingFirstPayment,
]);

export async function getPromoterDashboardData(promoterId: string): Promise<IPromoterDashboardData | null> {
  const promoter = await prisma.promoter.findUnique({
    where: { id: promoterId },
    select: {
      id: true,
      fullName: true,
      email: true,
      promoCode: true,
      status: true,
    },
  });

  if (!promoter || promoter.status !== 'ACTIVE') {
    return null;
  }

  const referrals = await prisma.referral.findMany({
    where: { promoterId },
    orderBy: { createdAt: 'desc' },
    include: {
      newBusiness: { select: { id: true, nombre: true } },
      firstPaidPlan: { select: { nombre: true } },
      liquidation: { select: { status: true } },
    },
  });

  const capturados = referrals.filter((r) => PENDING_PAYMENT.has(r.status)).length;
  /** Con primer pago registrado (elegible para recompensa salvo fraude/cancelación). */
  const calificados = referrals.filter((r) => r.firstPaidAt !== null).length;
  const pendientesLiquidacion = referrals.filter((r) => r.status === REFERRAL_STATUS.liquidationPending).length;
  const liquidados = referrals.filter((r) => r.status === REFERRAL_STATUS.liquidatedManually).length;
  const rechazadosFraude = referrals.filter((r) => r.status === REFERRAL_STATUS.rejectedFraud).length;
  const cancelados = referrals.filter((r) => r.status === REFERRAL_STATUS.cancelledUnpaidDeleted).length;

  const rows: IPromoterDashboardReferralRow[] = referrals.map((r) => ({
    id: r.id,
    businessName: r.newBusiness?.nombre ?? '(Negocio no disponible)',
    businessId: r.newBusinessId ?? '',
    status: r.status,
    statusLabel: labelForStatus(r.status),
    createdAt: r.createdAt.toISOString(),
    firstPaidAt: r.firstPaidAt?.toISOString() ?? null,
    planNombre: r.firstPaidPlan?.nombre ?? null,
    discountSnapshot: r.newBusinessDiscountSnapshot,
    rewardSnapshot: r.promoterRewardSnapshot,
    fraudReason: r.fraudReason,
    liquidationStatus: r.liquidation?.status ?? null,
  }));

  return {
    promoter: {
      id: promoter.id,
      fullName: promoter.fullName,
      email: promoter.email,
      promoCode: promoter.promoCode,
    },
    stats: {
      capturados,
      calificados,
      pendientesLiquidacion,
      liquidados,
      rechazadosFraude,
      cancelados,
    },
    referrals: rows,
  };
}
