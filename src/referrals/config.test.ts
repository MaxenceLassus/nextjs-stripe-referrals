import { describe, expect, it, beforeEach, vi } from 'vitest';

/**
 * The configuration must refuse to start on a combination it cannot honour.
 *
 * Each case here is a mistake that is otherwise discovered by a customer: a
 * tier that asks Stripe for a coupon above 100 percent is only reached by the
 * account with the most referrals, which is to say on the best day the program
 * ever has.
 */

async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import('./config');
}

const base = {
  APP_URL: 'https://tests.invalid',
  STRIPE_SECRET_KEY: 'sk_test_stub',
  STRIPE_WEBHOOK_SECRET: 'whsec_stub',
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('config', () => {
  it('accepts a program that lands exactly on 100 percent', async () => {
    const { config } = await loadConfig({
      ...base,
      REFERRAL_PERCENT_STEP: '25',
      REFERRAL_MAX_REFERRALS: '4',
    });
    expect(config.REFERRAL_PERCENT_STEP * config.REFERRAL_MAX_REFERRALS).toBe(100);
  });

  it('accepts a program that stops short of free', async () => {
    const { config } = await loadConfig({
      ...base,
      REFERRAL_PERCENT_STEP: '10',
      REFERRAL_MAX_REFERRALS: '5',
    });
    expect(config.REFERRAL_PERCENT_STEP * config.REFERRAL_MAX_REFERRALS).toBe(50);
  });

  it('refuses a program whose top tier exceeds 100 percent', async () => {
    await expect(
      loadConfig({ ...base, REFERRAL_PERCENT_STEP: '30', REFERRAL_MAX_REFERRALS: '5' }),
    ).rejects.toThrow(/150%/);
  });

  it('strips a trailing slash from APP_URL', async () => {
    // `${APP_URL}/signup` on a value ending in `/` produces `//signup`, which
    // is a protocol-relative URL pointing at a host called "signup".
    const { config } = await loadConfig({ ...base, APP_URL: 'https://example.com/' });
    expect(config.APP_URL).toBe('https://example.com');
  });

  it('refuses a coupon prefix Stripe could not use as an id', async () => {
    await expect(loadConfig({ ...base, REFERRAL_COUPON_PREFIX: 'my coupon!' })).rejects.toThrow(
      /REFERRAL_COUPON_PREFIX/,
    );
  });

  it('treats trials as not counting unless explicitly told otherwise', async () => {
    const { config } = await loadConfig(base);
    expect(config.REFERRAL_COUNT_TRIALING).toBe(false);

    const optedIn = await loadConfig({ ...base, REFERRAL_COUNT_TRIALING: 'true' });
    expect(optedIn.config.REFERRAL_COUNT_TRIALING).toBe(true);
  });

  it('is off when either Stripe secret is missing', async () => {
    vi.resetModules();
    vi.stubEnv('APP_URL', 'https://tests.invalid');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_stub');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const { stripeEnabled } = await import('./config');

    // A key without a webhook secret is the dangerous half-setup: discounts
    // can be written, but nothing will ever say a referral stopped paying.
    expect(stripeEnabled).toBe(false);
  });
});
