import { NextResponse } from 'next/server';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { listReferralEventsForAdmin } from '@/lib/referrals/adminQueries';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ referralId: string }> }
) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const { referralId } = await params;
    const items = await listReferralEventsForAdmin(referralId);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    console.error('❌ GET /api/admin/referrals/[referralId]/events:', error);
    return NextResponse.json({ ok: false, error: 'Error al cargar el historial' }, { status: 500 });
  }
}
