import { cookies } from 'next/headers';
import { config } from './config';

/**
 * Carrying a referral code from the link that was clicked to the account that
 * gets created.
 *
 * A cookie rather than a query parameter threaded through the funnel, because
 * the two are not the same journey: someone follows a shared link, reads the
 * landing page, leaves, comes back the next day from a bookmark, and signs up.
 * A query parameter is gone after the first navigation; the referrer would
 * never be credited for the referral they actually made.
 *
 * It is not signed, and that is not an oversight. A forged code can only ever
 * *give* a discount to the account it names — there is nothing to steal by
 * writing one — and the code is looked up against the database at signup
 * anyway. Signing it would add a secret to manage in exchange for nothing.
 */

const COOKIE = 'referral_code';

/** How long a captured code survives. Long enough to sleep on the decision. */
const MAX_AGE_SECONDS = config.REFERRAL_COOKIE_DAYS * 24 * 60 * 60;

/**
 * Codes are short, uppercase and alphanumeric-with-dashes by construction.
 * Anything else came from somewhere other than a link we minted, and is
 * dropped rather than stored and later looked up.
 */
function clean(raw: string | null | undefined): string | null {
  const value = raw?.trim().toUpperCase();
  if (!value) return null;
  if (value.length > 40) return null;
  if (!/^[A-Z0-9-]+$/.test(value)) return null;
  return value;
}

/**
 * Store a code seen on an incoming link.
 *
 * Callable from a Server Action or a Route Handler. In a Server Component,
 * Next.js does not allow writing cookies — use the middleware in
 * `referrals/middleware.ts` instead, which is the usual way to catch `?ref=`
 * on any page of the site rather than only on the signup page.
 */
export async function writeReferralCookie(raw: string | null | undefined): Promise<void> {
  const code = clean(raw);
  if (!code) return;

  const store = await cookies();
  store.set(COOKIE, code, {
    maxAge: MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: 'lax',
    // `lax` and not `strict`: the whole point is that this survives arriving
    // from somebody else's site, which is where a shared link is clicked.
    secure: config.APP_URL.startsWith('https://'),
    path: '/',
  });
}

/** The captured code, if there is one. */
export async function readReferralCookie(): Promise<string | null> {
  const store = await cookies();
  return clean(store.get(COOKIE)?.value);
}

/**
 * Drop the cookie once the account exists.
 *
 * Not merely tidy: without this, a shared browser signs its next account up
 * under the same referrer, and one link keeps paying out for every account
 * created on that machine for a month.
 */
export async function clearReferralCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export const REFERRAL_COOKIE_NAME = COOKIE;
export const REFERRAL_COOKIE_MAX_AGE = MAX_AGE_SECONDS;
export { clean as sanitizeReferralCode };
