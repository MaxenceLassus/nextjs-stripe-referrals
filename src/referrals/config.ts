import { z } from 'zod';

/**
 * Every knob this module has, read once and validated at import.
 *
 * Validated rather than merely read, because the two settings that decide the
 * money have a relationship a typo breaks silently. `REFERRAL_PERCENT_STEP` of
 * 30 with `REFERRAL_MAX_REFERRALS` of 5 asks for a 150-percent-off coupon,
 * which Stripe will not create. Discovering that at the moment a customer earns
 * their fifth referral — the best thing that can happen in this program — is
 * the worst possible time to discover it. So it fails at boot instead.
 */

const schema = z.object({
  APP_URL: z
    .string()
    .url()
    // A trailing slash turns `${APP_URL}/signup` into `//signup`, which is a
    // protocol-relative URL and not the page anyone meant.
    .transform((value) => value.replace(/\/+$/, '')),

  // `.transform` before `.optional` so that an empty value degrades instead of
  // crashing. `STRIPE_WEBHOOK_SECRET=` with nothing after it is how a .env file
  // says "this deployment does not have one", and it is written that way far
  // more often than the line is deleted. Refusing to boot on it would turn a
  // deployment that simply has not finished its Stripe setup into an outage.
  STRIPE_SECRET_KEY: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .optional()
    .transform((value) => (value?.trim() ? value.trim() : undefined)),

  REFERRAL_PERCENT_STEP: z.coerce.number().int().min(1).max(100).default(20),
  REFERRAL_MAX_REFERRALS: z.coerce.number().int().min(1).max(50).default(5),

  REFERRAL_COUNT_TRIALING: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),

  REFERRAL_COUPON_PREFIX: z
    .string()
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'REFERRAL_COUPON_PREFIX must be usable as a Stripe coupon id: letters, digits, underscore and dash only.',
    )
    .default('referral_off'),

  REFERRAL_COOKIE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Referral configuration is invalid:\n${detail}`);
}

const value = parsed.data;

if (value.REFERRAL_PERCENT_STEP * value.REFERRAL_MAX_REFERRALS > 100) {
  throw new Error(
    `Referral configuration is invalid:\n` +
      `  REFERRAL_PERCENT_STEP (${value.REFERRAL_PERCENT_STEP}) x REFERRAL_MAX_REFERRALS ` +
      `(${value.REFERRAL_MAX_REFERRALS}) = ${value.REFERRAL_PERCENT_STEP * value.REFERRAL_MAX_REFERRALS}%, ` +
      `and Stripe has no coupon above 100% off.\n` +
      `  Lower one of the two so the top tier lands on 100 or below.`,
  );
}

export const config = value;

/**
 * Is the Stripe half switched on?
 *
 * Both halves matter and they fail differently. Without a secret key nothing
 * can be written to Stripe at all. Without a webhook secret the endpoint
 * refuses every request, which is the safe direction — an unverified payload
 * must never move money — but it also means nothing will ever *tell* this app
 * that a referral started or stopped paying.
 *
 * Referrals are still tracked and still displayed when this is false, so a
 * deployment that has not finished its Stripe setup shows an honest empty
 * program rather than crashing. The dashboard says so out loud; see the
 * `stripeOffline` string.
 */
export const stripeEnabled = Boolean(config.STRIPE_SECRET_KEY && config.STRIPE_WEBHOOK_SECRET);
