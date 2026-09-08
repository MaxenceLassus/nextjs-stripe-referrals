import { db } from '../db';
import { stripeEnabled } from '../config';
import { discountPercent } from '../rules';
import { countActiveReferrals } from '../queries';
import { stripe } from './client';
import { ensureCoupon } from './coupons';

/**
 * Putting the earned discount onto the referrer's actual subscription.
 *
 * The rule this file exists to hold: **the referral rows are the truth, and the
 * coupon on the subscription is a copy of them that this function repairs.**
 * Nothing stores "how much discount does this account have" as a fact of its
 * own — it is recomputed from the rows every time, so what the dashboard shows
 * and what the invoice charges cannot drift apart by disagreeing.
 *
 * What `appliedPercent` records is different: it is what Stripe was last told,
 * which is the only way to know whether a write is needed at all.
 */

export type SyncOutcome =
  | { changed: false; reason: 'disabled' | 'no_subscription' | 'already_correct' }
  | { changed: true; from: number; to: number }
  | { changed: false; reason: 'failed'; error: string };

/**
 * Recompute this account's tier and make Stripe agree with it.
 *
 * Never throws. A referrer's discount failing to update must not take down the
 * webhook that was really about somebody's payment — Stripe would retry the
 * whole event and re-run everything else in it. The failure is recorded on the
 * row instead, where `referrals:reconcile` will find it and where the account's
 * own page can show it, rather than living only in a log line nobody reads.
 */
export async function syncDiscountFor(userId: string): Promise<SyncOutcome> {
  if (!stripeEnabled) return { changed: false, reason: 'disabled' };

  const customer = await db.referralCustomer.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true, appliedPercent: true, status: true, lastSyncError: true },
  });

  // No subscription is not a problem to report. An account on a free plan can
  // earn a tier perfectly well; there is simply nothing to hang it on until it
  // subscribes, and the moment it does, the checkout webhook comes back here.
  if (!customer?.stripeSubscriptionId) return { changed: false, reason: 'no_subscription' };

  // A subscription Stripe has ended cannot carry a discount, and asking it to
  // is an API error on every sweep for the rest of time.
  if (customer.status === 'CANCELED') return { changed: false, reason: 'no_subscription' };

  const target = discountPercent(await countActiveReferrals(userId));

  // The write is skipped when nothing moved. This is what makes `forever`
  // coupons safe to use: the discount is durable state, so re-writing it on
  // every event would be a Stripe call per webhook for no change at all. A row
  // carrying a past failure is always re-attempted, whatever the arithmetic
  // says, because its stored `appliedPercent` is a claim that was never true.
  if (target === customer.appliedPercent && !customer.lastSyncError) {
    return { changed: false, reason: 'already_correct' };
  }

  try {
    const coupon = target > 0 ? await ensureCoupon(target) : null;

    await stripe().subscriptions.update(customer.stripeSubscriptionId, {
      // `''` is how this API version clears subscription-level discounts.
      // Note it clears only the ones set here: a coupon applied to the Stripe
      // *customer* is inherited and is not this module's to remove.
      discounts: coupon ? [{ coupon }] : '',
      // Left at Stripe's default on purpose. A discount change is not a plan
      // change: it applies to the next invoice, and must not generate a credit
      // note or an immediate charge for the part of the month already served.
      proration_behavior: 'none',
    });

    await db.referralCustomer.update({
      where: { userId },
      data: { appliedPercent: target, lastSyncError: null },
    });

    return { changed: true, from: customer.appliedPercent, to: target };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[referrals] could not sync discount for ${userId}:`, message);

    await db.referralCustomer
      .update({ where: { userId }, data: { lastSyncError: message.slice(0, 500) } })
      .catch(() => undefined);

    return { changed: false, reason: 'failed', error: message };
  }
}

/**
 * Resync everyone whose tier this account's billing change could have moved.
 *
 * Two accounts, and both are needed:
 *
 *  - **this one**, because it may have just acquired the subscription there was
 *    previously nothing to attach a coupon to. Someone who invites three people
 *    and only then subscribes would otherwise pay full price until one of those
 *    three happened to change status.
 *  - **whoever referred it**, because this account starting to pay, lapsing or
 *    cancelling is exactly what moves their tier. This is the direction that
 *    makes the program work at all.
 */
export async function syncAfterBillingChange(userId: string): Promise<void> {
  await syncDiscountFor(userId);

  const referral = await db.referral.findUnique({
    where: { referredUserId: userId },
    select: { referrerUserId: true },
  });

  if (referral) await syncDiscountFor(referral.referrerUserId);
}
