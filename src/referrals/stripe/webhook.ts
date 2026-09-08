import type Stripe from 'stripe';
import { db } from '../db';
import { config, stripeEnabled } from '../config';
import { stripe } from './client';
import { linkCustomer, userIdForCustomer } from './status';
import { refreshSubscriptionState } from './refresh';

/**
 * The Stripe webhook. Mount it and point Stripe at it:
 *
 *   // src/app/api/referrals/webhook/route.ts
 *   export { POST } from '@/referrals/stripe/webhook'
 *
 * This endpoint is how the program learns that a referral started paying,
 * stopped paying, or went away. Unlike a subscription's own provisioning —
 * which an app can get away with pulling lazily whenever the customer visits —
 * a referral's billing change has to reach an account that is *not* the one
 * looking at the screen. Nobody is watching. So this is not the fast path here,
 * it is the path.
 *
 * Three correctness requirements, all of them load-bearing:
 *
 *  1. **Signature verification over the raw body.** Parsing the JSON first
 *     changes the bytes and the signature stops matching. Without a valid
 *     signature anyone who finds the URL can move discounts.
 *  2. **Idempotency.** Stripe redelivers on any non-2xx and on its own retry
 *     schedule. Every event id is recorded before it is handled, and the
 *     primary key is the gate: a concurrent redelivery loses the insert race
 *     and is dropped.
 *  3. **Never trust the payload's contents.** The event says *which* customer
 *     changed; what they changed to is re-read from the API. See refresh.ts.
 *
 * There is no CSRF or origin check, and there should not be: this is a
 * server-to-server call authenticated by the signature.
 */
export async function POST(request: Request): Promise<Response> {
  if (!stripeEnabled) {
    // Said plainly rather than failing as a bad signature, because this is the
    // single most common setup mistake and the error should name it.
    return new Response('Referral webhook is not configured (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET).', {
      status: 503,
    });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return new Response('Missing stripe-signature header', { status: 400 });

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (error) {
    console.error('[referrals] invalid webhook signature:', error);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    await db.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(`[referrals] handling ${event.type} (${event.id}) failed:`, error);

    // Release the idempotency record so Stripe's retry can actually retry.
    // Without this a transient database blip drops the event permanently, and
    // the referrer keeps a discount they stopped earning until somebody runs
    // the reconciler.
    await db.processedStripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);

    return new Response('Handler failed', { status: 500 });
  }

  return Response.json({ received: true });
}

/**
 * Which events matter, and why these.
 *
 * Deliberately few. Every branch ends in the same place — re-read this
 * account's state from the API — so the list is not "what do we do about each
 * event" but "which events mean somebody's billing may have moved". More
 * handlers would be more ways to be inconsistent, not more coverage.
 */
async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    // The first binding of a Stripe customer to an account. Without this, the
    // subscription events that follow have nowhere to land.
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      if (!userId || !session.customer) return;

      await linkCustomer(userId, String(session.customer));
      await refreshSubscriptionState(userId);
      return;
    }

    // Everything a subscription's life can do: created, upgraded, paused,
    // resumed, gone past_due, recovered, cancelled. `paused` and `resumed`
    // arrive here as updates and need no branch of their own.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserId(subscription);
      if (!userId) return;

      await refreshSubscriptionState(userId);
      return;
    }

    // A failed renewal is followed by a subscription.updated carrying
    // `past_due`, so strictly this is redundant. It is handled anyway because
    // it is the event that arrives *first*, and the sooner a referrer's
    // discount reflects a referral that stopped paying, the less chance it has
    // of surviving onto an invoice. `invoice.paid` is the same in reverse: the
    // recovery should be as prompt as the loss.
    case 'invoice.payment_failed':
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      if (!invoice.customer) return;

      const userId = await userIdForCustomer(String(invoice.customer));
      if (!userId) return;

      await refreshSubscriptionState(userId);
      return;
    }

    default:
      // Acknowledged and ignored. Returning a non-2xx would make Stripe retry
      // an event nothing here has an opinion about.
      return;
  }
}

/**
 * Find the local account behind a Stripe subscription.
 *
 * Metadata first, because `referralCheckoutOptions` puts it there and it
 * survives everything. The stored customer mapping second, because a
 * subscription created by hand in the Stripe dashboard has no metadata and
 * should still work — that is how most people test this the first time.
 */
async function resolveUserId(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.userId;
  if (fromMetadata) return fromMetadata;

  return userIdForCustomer(String(subscription.customer));
}

export { handleEvent as handleReferralStripeEvent };
