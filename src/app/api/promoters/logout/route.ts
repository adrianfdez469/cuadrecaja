import { NextResponse } from 'next/server';
import { PROMOTER_SESSION_COOKIE_NAME } from '@/lib/referrals/promoterSession';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PROMOTER_SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
