import type Stripe from 'stripe';
import type { ReferralSubscriptionStatus } from '@prisma/client';
import { db } from '../db';

/**
 * Keeping the local mirror of "what Stripe says" honest.
 */

/**
 * Stripe's status, as this program reads it.
 *
 * The mapping is the whole product rule in one function: only `active` earns a
 * referrer anything (and `trialing`, if configured). Everything a failed
 * payment can produce — `past_due` while Stripe retries, `unpaid` once it has
 * given up — lands on statuses that count for nothing, which is what makes
 * "the discount stops at the first missed payment" true rather than aspirational.
 *
 * `incomplete_expired` is a checkout that was started and never paid for; it is
 * not a lapse, it is an account that was never a customer, so it maps to NONE.
 */
export function mapStripeStatus(status: Stripe.Subscription.Status): ReferralSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'trialing':
      return 'TRIALING';
    case 'past_due':
    case 'unpaid':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'paused':
      return 'PAUSED';
    case 'incomplete':
      return 'INCOMPLETE';
    case 'incomplete_expired':
      return 'NONE';
    default:
      // A status Stripe added after this was written. Treating an unknown as
      // "earns nothing" is the safe direction: the worst case is a referrer
      // briefly missing a discount they are owed, which the reconciler fixes,
      // rather than a discount granted for a state nobody has read.
      return 'NONE';
  }
}

export interface MirrorInput {
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  status: ReferralSubscriptionStatus;
  stripeStatus?: string | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  /** When the Stripe read behind this data was taken. */
  readAt: Date;
}

/**
 * Write what Stripe said, unless something newer has already been written.
 *
 * This guard is the fix for a real class of bug rather than defensive
 * decoration. Stripe does not guarantee webhook delivery order: a
 * `subscription.updated` carrying `past_due` can arrive after the `active` that
 * superseded it. Handlers re-read the subscription from the API precisely so
 * they never trust a stale payload — but two handlers running concurrently can
 * still finish out of order, and the one that read *earlier* would overwrite the
 * one that read later.
 *
 * So the read timestamp travels with the data, and a write that is older than
 * what is stored is dropped. For a referral program this matters more than it
 * would for entitlement alone: a wrong status here moves the discount on
 * somebody *else's* subscription.
 *
 * Returns whether anything was written.
 */
export async function writeMirror(input: MirrorInput): Promise<boolean> {
  const data = {
    ...(input.stripeCustomerId !== undefined ? { stripeCustomerId: input.stripeCustomerId } : {}),
    ...(input.stripeSubscriptionId !== undefined
      ? { stripeSubscriptionId: input.stripeSubscriptionId }
      : {}),
    status: input.status,
    stripeStatus: input.stripeStatus ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
    syncedAt: input.readAt,
  };

  const { count } = await db.referralCustomer.updateMany({
    where: { userId: input.userId, syncedAt: { lt: input.readAt } },
    data,
  });
  if (count > 0) return true;

  const existing = await db.referralCustomer.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  // A row is there and it is at least as fresh as this read: a concurrent
  // handler already wrote a newer truth, and this one is history.
  if (existing) return false;

  try {
    await db.referralCustomer.create({ data: { userId: input.userId, ...data } });
    return true;
  } catch (error) {
    // Lost the create race. The winner's data is at least as fresh as ours.
    if ((error as { code?: string } | null)?.code === 'P2002') return false;
    throw error;
  }
}

/**
 * Bind a Stripe customer to an account before any subscription exists.
 *
 * Called from checkout completion. Without it, the first subscription webhook
 * for a brand-new customer has no way to tell which account it belongs to
 * except the metadata on the subscription, and a subscription created by hand
 * in the Stripe dashboard has none.
 */
export async function linkCustomer(userId: string, stripeCustomerId: string): Promise<void> {
  await db.referralCustomer.upsert({
    where: { userId },
    create: { userId, stripeCustomerId },
    update: { stripeCustomerId },
  });
}

/** Which account a Stripe customer id belongs to, if we have seen it. */
export async function userIdForCustomer(stripeCustomerId: string): Promise<string | null> {
  const row = await db.referralCustomer.findUnique({
    where: { stripeCustomerId },
    select: { userId: true },
  });
  return row?.userId ?? null;
}
