import type Stripe from 'stripe';
import { db } from '../db';
import { stripeEnabled } from '../config';
import { stripe } from './client';
import { mapStripeStatus, writeMirror } from './status';
import { syncAfterBillingChange } from './discount';

/**
 * Read one account's billing state from Stripe and make everything follow.
 *
 * Every path into this module funnels here — the webhook, the reconciler, and
 * the demo's manual refresh button — so an account ends up in the same state
 * whichever one got there first.
 *
 * **It reads from the API rather than believing an event payload, and that is
 * the point.** Stripe does not guarantee webhook ordering: a `subscription.
 * updated` carrying `past_due` can be delivered after the `active` that
 * replaced it. Handling the payload would write the older truth over the newer
 * one and move a discount on an account belonging to someone who did nothing.
 * One extra API call per event buys immunity from the entire problem, and the
 * read timestamp travels into `writeMirror` so that concurrent handlers finishing
 * out of order cannot undo each other either.
 */
export async function refreshSubscriptionState(userId: string): Promise<boolean> {
  if (!stripeEnabled) return false;

  const record = await db.referralCustomer.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (!record?.stripeCustomerId) return false;

  let subscriptions: Stripe.ApiList<Stripe.Subscription>;
  const readAt = new Date();

  try {
    subscriptions = await stripe().subscriptions.list({
      customer: record.stripeCustomerId,
      // `all`, not `active`: a subscription that has just lapsed is exactly the
      // one that has to be seen, or the referrer keeps a discount they no
      // longer earn — which is the failure this whole module exists to avoid.
      status: 'all',
      limit: 10,
    });
  } catch (error) {
    // The customer is gone from this Stripe account: a rotated key pointing at
    // a different account, or test data wiped. Record the truth (this account
    // has no subscription) rather than retrying forever against nothing.
    if ((error as Stripe.errors.StripeError | null)?.code === 'resource_missing') {
      await writeMirror({
        userId,
        stripeSubscriptionId: null,
        status: 'NONE',
        stripeStatus: null,
        readAt,
      });
      await syncAfterBillingChange(userId);
      return true;
    }
    throw error;
  }

  // Someone mid-upgrade briefly has two. A live one wins; if none is live, the
  // most recent decides the (non-earning) status.
  const live = subscriptions.data.find((subscription) =>
    ['active', 'trialing', 'past_due'].includes(subscription.status),
  );
  const chosen = live ?? subscriptions.data[0];

  if (!chosen) {
    await writeMirror({
      userId,
      stripeSubscriptionId: null,
      status: 'NONE',
      stripeStatus: null,
      readAt,
    });
    await syncAfterBillingChange(userId);
    return true;
  }

  const item = chosen.items.data[0];

  await writeMirror({
    userId,
    stripeSubscriptionId: chosen.id,
    status: mapStripeStatus(chosen.status),
    stripeStatus: chosen.status,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    cancelAtPeriodEnd: chosen.cancel_at_period_end,
    readAt,
  });

  await syncAfterBillingChange(userId);
  return true;
}
