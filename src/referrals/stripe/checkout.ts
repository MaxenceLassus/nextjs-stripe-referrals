import type Stripe from 'stripe';

/**
 * What to merge into your own Checkout session creation so this module can tell
 * whose subscription is whose.
 *
 *   const session = await stripe.checkout.sessions.create({
 *     mode: 'subscription',
 *     line_items: [{ price, quantity: 1 }],
 *     ...referralCheckoutOptions(userId),
 *   })
 *
 * Both fields are set, and both earn their place. `client_reference_id` is what
 * the `checkout.session.completed` event carries back, and it is how the
 * customer gets bound to the account in the first place. The subscription
 * metadata is the durable copy: months later, an event about a renewal has no
 * checkout session behind it, and a subscription somebody created by hand in
 * the Stripe dashboard never had one.
 */
export function referralCheckoutOptions(userId: string): {
  client_reference_id: string;
  subscription_data: Stripe.Checkout.SessionCreateParams.SubscriptionData;
} {
  return {
    client_reference_id: userId,
    subscription_data: { metadata: { userId } },
  };
}
