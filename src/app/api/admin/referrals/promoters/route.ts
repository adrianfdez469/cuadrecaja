import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { adminPromotersQuerySchema } from '@/schemas/referral';
import { listPromotersForAdmin } from '@/lib/referrals/adminQueries';

export async function GET(request: NextRequest) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const query = adminPromotersQuerySchema.parse({
      q: sp.get('q') ?? undefined,
      status: sp.get('status') ?? undefined,
    });

    const items = await listPromotersForAdmin(query);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? 'Parámetros inválidos' },
        { status: 400 }
      );
    }
    console.error('❌ GET /api/admin/referrals/promoters:', error);
    return NextResponse.json({ ok: false, error: 'Error al listar promotores' }, { status: 500 });
  }
}
