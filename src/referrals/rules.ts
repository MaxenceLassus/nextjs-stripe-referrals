import { config } from './config';

/**
 * The rules, with no database and no Stripe in them.
 *
 * Separate from everything else because these are the decisions worth testing,
 * and a test that has to reach Postgres to check an arithmetic tier is not
 * testing the tier. Everything here is pure or reads config.
 */

/** Referrals beyond this many active accounts earn nothing more. */
export const maxReferrals = config.REFERRAL_MAX_REFERRALS;

/** Percent off per active referral, up to the cap above. */
export const percentStep = config.REFERRAL_PERCENT_STEP;

/** The best a referrer can do: what the cap is worth. */
export const maxPercent = percentStep * maxReferrals;

/**
 * How many percent off, for a given number of active referrals.
 *
 * Clamped at both ends. The upper clamp is the product rule — past the cap a
 * referral is worth nothing — and it is also a safety property: a percentage
 * above 100 has no coupon behind it, so an uncapped count would fall through
 * to "no discount at all" for the account that earned the most.
 *
 * The lower clamp keeps a count that somehow arrived negative from inventing a
 * surcharge on someone's card.
 */
export function discountPercent(activeReferrals: number): number {
  const counted = Math.min(Math.max(Math.floor(activeReferrals) || 0, 0), maxReferrals);
  return counted * percentStep;
}

/** What a subscription costs after the discount, in the smallest currency unit. */
export function discountedAmount(amount: number, percent: number): number {
  return Math.round((amount * (100 - percent)) / 100);
}

/**
 * Turn a name, or the local part of an email, into the readable half of a
 * referral code.
 *
 * Accents are folded rather than dropped, so "Café des Chartrons" reads as
 * CAFE-DES-CHARTRONS instead of quietly losing its C.
 */
export function referralCodeBase(input: string): string {
  const slug = input
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);

  // A name made entirely of punctuation, or an empty one, still needs a code.
  return slug || 'FRIEND';
}

/**
 * The link a referrer shares.
 *
 * The code is percent-encoded: a code is derived from a display name the
 * account holder chose, and an unescaped `&` in it would silently open a
 * second query parameter and truncate the code.
 */
export function referralLink(code: string, path = '/signup'): string {
  return `${config.APP_URL}${path}?ref=${encodeURIComponent(code)}`;
}

/** The Stripe coupon id for a tier. The percent is part of the id on purpose. */
export function couponIdFor(percent: number): string {
  return `${config.REFERRAL_COUPON_PREFIX}_${percent}`;
}
