import { describe, expect, it, vi, beforeEach } from 'vitest';

const findUnique = vi.fn();
const update = vi.fn();
const referralFindUnique = vi.fn();
const subscriptionsUpdate = vi.fn();
const countActiveReferrals = vi.fn();
const ensureCoupon = vi.fn();

vi.mock('../db', () => ({
  db: {
    referralCustomer: { findUnique, update },
    referral: { findUnique: referralFindUnique },
  },
}));
vi.mock('../queries', () => ({ countActiveReferrals }));
vi.mock('./coupons', () => ({ ensureCoupon }));
vi.mock('./client', () => ({
  stripe: () => ({ subscriptions: { update: subscriptionsUpdate } }),
}));

const { syncDiscountFor } = await import('./discount');

beforeEach(() => {
  for (const fn of [findUnique, update, referralFindUnique, subscriptionsUpdate, countActiveReferrals, ensureCoupon])
    fn.mockReset();
  update.mockResolvedValue({});
  subscriptionsUpdate.mockResolvedValue({});
  ensureCoupon.mockImplementation(async (percent: number) => `referral_off_${percent}`);
});

const subscribed = (overrides = {}) => ({
  stripeSubscriptionId: 'sub_1',
  appliedPercent: 0,
  status: 'ACTIVE',
  lastSyncError: null,
  ...overrides,
});

describe('syncDiscountFor', () => {
  it('attaches the coupon its referrals have earned', async () => {
    findUnique.mockResolvedValue(subscribed());
    countActiveReferrals.mockResolvedValue(2);

    expect(await syncDiscountFor('u1')).toEqual({ changed: true, from: 0, to: 40 });
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ discounts: [{ coupon: 'referral_off_40' }] }),
    );
  });

  it('removes the discount when the last paying referral stops', async () => {
    // The headline promise: a missed payment takes the discount away. With a
    // `forever` coupon this removal is the only thing that ends it, so it has
    // to actually be written.
    findUnique.mockResolvedValue(subscribed({ appliedPercent: 20 }));
    countActiveReferrals.mockResolvedValue(0);

    expect(await syncDiscountFor('u1')).toEqual({ changed: true, from: 20, to: 0 });
    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ discounts: '' }),
    );
    expect(ensureCoupon).not.toHaveBeenCalled();
  });

  it('never prorates a discount change', async () => {
    // A discount change is not a plan change. Prorating would credit or charge
    // for the part of the month already served, which nobody asked for.
    findUnique.mockResolvedValue(subscribed());
    countActiveReferrals.mockResolvedValue(1);

    await syncDiscountFor('u1');

    expect(subscriptionsUpdate).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ proration_behavior: 'none' }),
    );
  });

  it('writes nothing to Stripe when the tier has not moved', async () => {
    findUnique.mockResolvedValue(subscribed({ appliedPercent: 40 }));
    countActiveReferrals.mockResolvedValue(2);

    expect(await syncDiscountFor('u1')).toEqual({ changed: false, reason: 'already_correct' });
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it('retries a row whose last write failed, even at the same tier', async () => {
    // `appliedPercent` after a failure is a claim that was never true, so the
    // arithmetic agreeing with it proves nothing.
    findUnique.mockResolvedValue(subscribed({ appliedPercent: 40, lastSyncError: 'boom' }));
    countActiveReferrals.mockResolvedValue(2);

    expect(await syncDiscountFor('u1')).toEqual({ changed: true, from: 40, to: 40 });
    expect(subscriptionsUpdate).toHaveBeenCalled();
  });

  it('does nothing for an account with no subscription to discount', async () => {
    findUnique.mockResolvedValue(null);

    expect(await syncDiscountFor('u1')).toEqual({ changed: false, reason: 'no_subscription' });
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it('leaves a cancelled subscription alone', async () => {
    // Stripe rejects a discount write to an ended subscription, and it would
    // be retried on every sweep for the rest of time.
    findUnique.mockResolvedValue(subscribed({ status: 'CANCELED', appliedPercent: 20 }));
    countActiveReferrals.mockResolvedValue(0);

    expect(await syncDiscountFor('u1')).toEqual({ changed: false, reason: 'no_subscription' });
    expect(subscriptionsUpdate).not.toHaveBeenCalled();
  });

  it('records a Stripe failure instead of throwing it at the webhook', async () => {
    // Throwing would fail the whole webhook, and Stripe would retry an event
    // that was really about somebody's payment, re-running everything in it.
    findUnique.mockResolvedValue(subscribed());
    countActiveReferrals.mockResolvedValue(1);
    subscriptionsUpdate.mockRejectedValue(new Error('Stripe is down'));

    const outcome = await syncDiscountFor('u1');

    expect(outcome).toEqual({ changed: false, reason: 'failed', error: 'Stripe is down' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastSyncError: 'Stripe is down' } }),
    );
  });

  it('caps at the top tier rather than asking for an impossible coupon', async () => {
    findUnique.mockResolvedValue(subscribed());
    countActiveReferrals.mockResolvedValue(99);

    await syncDiscountFor('u1');

    expect(ensureCoupon).toHaveBeenCalledWith(100);
  });
});
