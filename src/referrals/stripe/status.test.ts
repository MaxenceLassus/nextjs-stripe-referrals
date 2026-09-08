import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

const updateMany = vi.fn();
const findUnique = vi.fn();
const create = vi.fn();

vi.mock('../db', () => ({
  db: { referralCustomer: { updateMany, findUnique, create } },
}));

const { mapStripeStatus, writeMirror } = await import('./status');

beforeEach(() => {
  updateMany.mockReset();
  findUnique.mockReset();
  create.mockReset();
});

describe('mapStripeStatus', () => {
  it('counts only a paying subscription as active', () => {
    expect(mapStripeStatus('active')).toBe('ACTIVE');
  });

  it('keeps a trial distinct from a paying customer', () => {
    // These must not collapse: whether a trial counts is the one setting
    // standing between this program and a farm of free accounts.
    expect(mapStripeStatus('trialing')).toBe('TRIALING');
  });

  it('treats every shape of payment failure as earning nothing', () => {
    expect(mapStripeStatus('past_due')).toBe('PAST_DUE');
    expect(mapStripeStatus('unpaid')).toBe('PAST_DUE');
  });

  it('separates an ended subscription from one that never started', () => {
    expect(mapStripeStatus('canceled')).toBe('CANCELED');
    expect(mapStripeStatus('incomplete')).toBe('INCOMPLETE');
    expect(mapStripeStatus('incomplete_expired')).toBe('NONE');
  });

  it('reads a paused subscription as paused', () => {
    expect(mapStripeStatus('paused')).toBe('PAUSED');
  });

  it('falls back to earning nothing for a status it has never seen', () => {
    // Stripe adds statuses. Granting a discount for a state nobody has read is
    // the failure that reaches an invoice; withholding one is fixed by the
    // reconciler within the hour.
    expect(mapStripeStatus('some_future_status' as Stripe.Subscription.Status)).toBe('NONE');
  });
});

describe('writeMirror', () => {
  const older = new Date('2026-05-04T10:00:00Z');
  const newer = new Date('2026-05-04T10:00:05Z');

  it('writes when its read is newer than what is stored', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    expect(await writeMirror({ userId: 'u1', status: 'ACTIVE', readAt: newer })).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', syncedAt: { lt: newer } } }),
    );
  });

  it('drops a write whose read is older than what is stored', async () => {
    // The bug this exists for: Stripe does not guarantee webhook ordering, so
    // a handler that read `past_due` can finish after one that read `active`.
    // Letting it land would move the discount on somebody else's subscription.
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ id: 'row1' });

    expect(await writeMirror({ userId: 'u1', status: 'PAST_DUE', readAt: older })).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates the row the first time an account is seen', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'row1' });

    expect(await writeMirror({ userId: 'u1', status: 'ACTIVE', readAt: newer })).toBe(true);
    expect(create).toHaveBeenCalled();
  });

  it('yields to the winner when two handlers create the row at once', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await writeMirror({ userId: 'u1', status: 'ACTIVE', readAt: newer })).toBe(false);
  });

  it('does not clobber a stored customer id it was not given', async () => {
    updateMany.mockResolvedValue({ count: 1 });

    await writeMirror({ userId: 'u1', status: 'ACTIVE', readAt: newer });

    const [[call]] = updateMany.mock.calls as [[{ data: Record<string, unknown> }]];
    expect(call.data).not.toHaveProperty('stripeCustomerId');
  });
});
