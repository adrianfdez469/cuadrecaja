import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { adminReferralsQuerySchema } from '@/schemas/referral';
import { listReferralsForAdmin } from '@/lib/referrals/adminQueries';

function parseOptionalDate(value: string | null): Date | undefined {
  if (!value || !value.trim()) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ ok: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;
    const query = adminReferralsQuerySchema.parse({
      status: sp.get('status') ?? undefined,
      promoterId: sp.get('promoterId') ?? undefined,
      planId: sp.get('planId') ?? undefined,
      from: parseOptionalDate(sp.get('from')),
      to: parseOptionalDate(sp.get('to')),
    });

    const items = await listReferralsForAdmin(query);

    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: error.issues[0]?.message ?? 'Parámetros inválidos' },
        { status: 400 }
      );
    }
    console.error('❌ GET /api/admin/referrals:', error);
    return NextResponse.json({ ok: false, error: 'Error al listar referidos' }, { status: 500 });
  }
}
