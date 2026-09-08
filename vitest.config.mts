import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // The suite is pure logic and recorded payloads: no database, no network,
    // no Stripe key. These stubs exist only so importing `config.ts` from a
    // test does not have to reach a real environment.
    env: {
      APP_URL: 'https://tests.invalid',
      DATABASE_URL: 'postgresql://tests.invalid/tests',
      STRIPE_SECRET_KEY: 'sk_test_stub',
      STRIPE_WEBHOOK_SECRET: 'whsec_stub',
      STRIPE_PRICE_ID: 'price_stub',
      REFERRAL_PERCENT_STEP: '20',
      REFERRAL_MAX_REFERRALS: '5',
      REFERRAL_COUNT_TRIALING: 'false',
      REFERRAL_COUPON_PREFIX: 'referral_off',
    },
  },
});
