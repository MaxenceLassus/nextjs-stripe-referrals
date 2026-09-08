import Stripe from 'stripe';
import { config } from '../config';

/**
 * The Stripe client.
 *
 * The API version is pinned rather than left floating. Stripe ships breaking
 * changes behind versions, and inheriting whichever one your account happens to
 * be set to means a payload shape can change under a deployment that nobody
 * touched. Bump it deliberately, after reading the changelog.
 */

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!config.STRIPE_SECRET_KEY) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Guard Stripe calls with `stripeEnabled` from referrals/config.',
    );
  }

  client ??= new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' });
  return client;
}
