import type Stripe from 'stripe';
import { stripe } from './client';
import { couponIdFor } from '../rules';

/**
 * The coupons behind each tier, created on demand.
 *
 * Two decisions here are load-bearing.
 *
 * **The percentage is part of the coupon id** (`referral_off_20`). A Stripe
 * coupon's `percent_off` is immutable once created, so an id that did not name
 * its percentage would quietly keep applying 20% off after someone changed
 * REFERRAL_PERCENT_STEP to 25 — the config would say one thing and every
 * invoice would do another. With the percentage in the id, changing the setting
 * asks for a coupon that does not exist yet, and gets one that is right.
 *
 * **`duration: 'forever'`, not `'once'`.** A `once` coupon is consumed by a
 * single invoice and falls off by itself, which sounds like a tidy way to make
 * "recalculated every month" true, and is a trap: it makes the discount depend
 * on something re-attaching it before *every* invoice, so any window in which
 * the sync did not run is a full-price charge that nothing reports. A `forever`
 * coupon is state — it stays until this app removes it — so a sync that is late
 * costs nothing and a sync that never runs is visible as a wrong discount
 * rather than as an invisible one.
 *
 * Nothing is ever deleted. A coupon is referenced by the subscriptions and
 * invoices it has discounted; removing one to tidy up rewrites history that
 * your accountant may be relying on.
 */

const cache = new Map<number, string>();

export async function ensureCoupon(percent: number): Promise<string> {
  if (percent <= 0 || percent > 100 || !Number.isInteger(percent)) {
    throw new Error(`Refusing to create a coupon for ${percent}%: must be an integer in 1..100.`);
  }

  const cached = cache.get(percent);
  if (cached) return cached;

  const id = couponIdFor(percent);

  try {
    const existing = await stripe().coupons.retrieve(id);

    // An id that exists but says something else is not ours to reuse. This
    // happens when a coupon was hand-made in the dashboard under a colliding
    // name, and silently applying it would discount by an amount nobody chose.
    if (existing.percent_off !== percent) {
      throw new Error(
        `Stripe coupon "${id}" already exists with percent_off=${existing.percent_off}, ` +
          `but this app needs ${percent}. Rename yours, or set REFERRAL_COUPON_PREFIX ` +
          `to something unused.`,
      );
    }

    cache.set(percent, id);
    return id;
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  try {
    const created = await stripe().coupons.create({
      id,
      percent_off: percent,
      duration: 'forever',
      name: `Referral reward - ${percent}% off`,
      metadata: { managed_by: 'nextjs-stripe-referrals' },
    });
    cache.set(percent, created.id);
    return created.id;
  } catch (error) {
    // Two requests created it at the same time; the loser reads the winner's.
    if (isDuplicate(error)) {
      cache.set(percent, id);
      return id;
    }
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (error as Stripe.errors.StripeError | null)?.code === 'resource_missing';
}

function isDuplicate(error: unknown): boolean {
  const stripeError = error as Stripe.errors.StripeError | null;
  return (
    stripeError?.code === 'resource_already_exists' ||
    Boolean(stripeError?.message?.includes('already exists'))
  );
}

/** Test seam: forget what has been created this process. */
export function resetCouponCache(): void {
  cache.clear();
}
