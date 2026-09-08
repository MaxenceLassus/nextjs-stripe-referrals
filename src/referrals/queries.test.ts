import { describe, expect, it, vi } from 'vitest';

/**
 * The counting rule, which is the whole anti-abuse story.
 *
 * With trials counted, five trial accounts take a subscription to free without
 * a single card being charged, and all five can be cancelled before they ever
 * are. With trials excluded, the only way to earn a discount is for real
 * subscriptions to be really paid for, which is not an exploit but the program.
 */
async function loadWith(countTrialing: string) {
  vi.resetModules();
  vi.stubEnv('APP_URL', 'https://tests.invalid');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_stub');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_stub');
  vi.stubEnv('REFERRAL_COUNT_TRIALING', countTrialing);
  vi.doMock('./db', () => ({ db: {} }));
  return import('./queries');
}

describe('COUNTING_STATUSES', () => {
  it('counts only paying referrals by default', async () => {
    const { COUNTING_STATUSES } = await loadWith('false');

    expect(COUNTING_STATUSES).toEqual(['ACTIVE']);
    expect(COUNTING_STATUSES).not.toContain('TRIALING');
    expect(COUNTING_STATUSES).not.toContain('PAST_DUE');
  });

  it('includes trials only when explicitly opted in', async () => {
    const { COUNTING_STATUSES } = await loadWith('true');

    expect(COUNTING_STATUSES).toEqual(['ACTIVE', 'TRIALING']);
  });

  it('never counts a failed payment, whatever the trial setting', async () => {
    // "The discount goes away at the first missed payment" is only true
    // because PAST_DUE is absent from both configurations.
    for (const setting of ['true', 'false']) {
      const { COUNTING_STATUSES } = await loadWith(setting);
      expect(COUNTING_STATUSES).not.toContain('PAST_DUE');
      expect(COUNTING_STATUSES).not.toContain('CANCELED');
      expect(COUNTING_STATUSES).not.toContain('PAUSED');
      expect(COUNTING_STATUSES).not.toContain('INCOMPLETE');
      expect(COUNTING_STATUSES).not.toContain('NONE');
    }
  });
});
