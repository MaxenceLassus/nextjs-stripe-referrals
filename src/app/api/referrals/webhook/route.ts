/**
 * The Stripe webhook, mounted.
 *
 * This is the entire file in your app too. Point a Stripe endpoint at
 * `/api/referrals/webhook` and subscribe it to `checkout.session.completed`,
 * `customer.subscription.*`, `invoice.paid` and `invoice.payment_failed`.
 */
export { POST } from '@/referrals/stripe/webhook';

export const dynamic = 'force-dynamic';
