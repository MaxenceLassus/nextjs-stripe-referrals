import { redirect } from 'next/navigation';
import { stripe } from '@/referrals/stripe/client';
import { referralCheckoutOptions } from '@/referrals/stripe/checkout';
import { linkCustomer } from '@/referrals/stripe/status';
import { config, stripeEnabled } from '@/referrals/config';
import { db } from '@/referrals/db';
import { currentUser } from '@/demo/session';

export const dynamic = 'force-dynamic';

/**
 * The demo's checkout. Your app already has one; the only line it needs from
 * this file is the `...referralCheckoutOptions(user.id)` spread.
 */
export async function POST(): Promise<Response> {
  if (!stripeEnabled || !process.env.STRIPE_PRICE_ID) {
    return new Response('Stripe is not configured (STRIPE_SECRET_KEY / STRIPE_PRICE_ID).', {
      status: 503,
    });
  }

  const user = await currentUser();
  if (!user) return new Response('Not signed in', { status: 401 });

  // Reuse this account's customer if it has one, so a second subscription does
  // not create a second customer that the webhook cannot match back.
  const existing = await db.referralCustomer.findUnique({
    where: { userId: user.id },
    select: { stripeCustomerId: true },
  });

  const customerId =
    existing?.stripeCustomerId ??
    (await stripe().customers.create({ email: user.email, metadata: { userId: user.id } })).id;

  if (!existing?.stripeCustomerId) await linkCustomer(user.id, customerId);

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${config.APP_URL}/dashboard?checkout=done`,
    cancel_url: `${config.APP_URL}/dashboard?checkout=cancelled`,
    ...referralCheckoutOptions(user.id),
  });

  if (!session.url) return new Response('Stripe returned no checkout URL', { status: 502 });
  redirect(session.url);
}
