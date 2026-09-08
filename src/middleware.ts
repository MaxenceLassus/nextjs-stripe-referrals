import { NextResponse, type NextRequest } from 'next/server';
import { captureReferral } from '@/referrals/middleware';

/**
 * Catch `?ref=CODE` on any page, not only on the signup form.
 *
 * People share the page that convinced them, which is the home or pricing page
 * far more often than it is `/signup`. This is the whole integration: one call
 * inside whatever middleware you already have.
 */
export function middleware(request: NextRequest) {
  return captureReferral(request, NextResponse.next());
}

export const config = {
  // Static assets cannot carry a referral and do not need a cookie written.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
