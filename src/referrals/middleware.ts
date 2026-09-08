import type { NextRequest, NextResponse } from 'next/server';
import { config } from './config';
import { REFERRAL_COOKIE_NAME, REFERRAL_COOKIE_MAX_AGE, sanitizeReferralCode } from './capture';

/**
 * Catch `?ref=CODE` anywhere on the site, not only on the signup page.
 *
 * People share a referral link to the page that sold them, which is the home
 * page or a pricing page far more often than it is `/signup`. Capturing only on
 * the signup form means those referrals are silently lost.
 *
 * Written as a function you call from your own `middleware.ts` rather than as a
 * middleware itself, because a Next.js app gets exactly one and yours very
 * likely already does something.
 *
 *   export function middleware(request: NextRequest) {
 *     const response = NextResponse.next()
 *     captureReferral(request, response)
 *     return response
 *   }
 *
 * The first code wins: someone who arrives through Sarah's link and later
 * through Tom's stays Sarah's referral. Otherwise the last person to send a
 * link before signup collects a referral they did not make.
 */
export function captureReferral(request: NextRequest, response: NextResponse): NextResponse {
  const code = sanitizeReferralCode(request.nextUrl.searchParams.get('ref'));
  if (!code) return response;

  if (request.cookies.get(REFERRAL_COOKIE_NAME)?.value) return response;

  response.cookies.set(REFERRAL_COOKIE_NAME, code, {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.APP_URL.startsWith('https://'),
    path: '/',
  });

  return response;
}
