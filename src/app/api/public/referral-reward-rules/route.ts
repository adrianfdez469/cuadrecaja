import { NextResponse } from 'next/server';
import { getPublicReferralRewardRules } from '@/lib/referrals/publicRewardRules';

export async function GET() {
  try {
    const items = await getPublicReferralRewardRules();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('❌ GET /api/public/referral-reward-rules:', error);
    return NextResponse.json(
      { ok: false, error: 'Error al obtener las reglas de recompensa.' },
      { status: 500 }
    );
  }
}
