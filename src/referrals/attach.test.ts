import { describe, expect, it, vi, beforeEach } from 'vitest';

const referralCreate = vi.fn();
const codeFindUnique = vi.fn();
const customerFindUnique = vi.fn();
const syncDiscountFor = vi.fn();

vi.mock('./db', () => ({
  db: {
    referral: { create: referralCreate, findUnique: vi.fn() },
    referralCode: { findUnique: codeFindUnique },
    referralCustomer: { findUnique: customerFindUnique },
  },
}));
vi.mock('./stripe/discount', () => ({ syncDiscountFor }));

const { attachReferral } = await import('./attach');

beforeEach(() => {
  for (const fn of [referralCreate, codeFindUnique, customerFindUnique, syncDiscountFor]) fn.mockReset();
  referralCreate.mockResolvedValue({ id: 'ref_1' });
  customerFindUnique.mockResolvedValue(null);
  syncDiscountFor.mockResolvedValue({ changed: false, reason: 'no_subscription' });
});

describe('attachReferral', () => {
  it('credits the account that owns the code', async () => {
    codeFindUnique.mockResolvedValue({ userId: 'sarah' });

    expect(await attachReferral('newbie', 'SARAH-9F3K')).toEqual({
      attached: true,
      referrerUserId: 'sarah',
    });
    expect(referralCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referrerUserId: 'sarah', referredUserId: 'newbie' }),
      }),
    );
  });

  it('does nothing at all without a code', async () => {
    expect(await attachReferral('newbie', null)).toEqual({ attached: false, reason: 'no_code' });
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it('refuses a self-referral', async () => {
    // Otherwise the program pays anyone who reads their own link.
    codeFindUnique.mockResolvedValue({ userId: 'newbie' });

    expect(await attachReferral('newbie', 'NEWBIE-1A2B')).toEqual({
      attached: false,
      reason: 'self_referral',
    });
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it('ignores a code no account owns', async () => {
    codeFindUnique.mockResolvedValue(null);

    expect(await attachReferral('newbie', 'MADE-UP')).toEqual({
      attached: false,
      reason: 'unknown_code',
    });
  });

  it('refuses to attribute an account that has already been a customer', async () => {
    // The one way to earn a discount without anyone new ever paying: replay
    // this call against established accounts and collect them retroactively.
    codeFindUnique.mockResolvedValue({ userId: 'sarah' });
    customerFindUnique.mockResolvedValue({ status: 'ACTIVE' });

    expect(await attachReferral('established', 'SARAH-9F3K')).toEqual({
      attached: false,
      reason: 'already_customer',
    });
    expect(referralCreate).not.toHaveBeenCalled();
  });

  it('still attributes an account that reached checkout and never paid', async () => {
    codeFindUnique.mockResolvedValue({ userId: 'sarah' });
    customerFindUnique.mockResolvedValue({ status: 'NONE' });

    expect(await attachReferral('newbie', 'SARAH-9F3K')).toEqual({
      attached: true,
      referrerUserId: 'sarah',
    });
  });

  it('reports a second attribution rather than duplicating one', async () => {
    codeFindUnique.mockResolvedValue({ userId: 'tom' });
    referralCreate.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    expect(await attachReferral('newbie', 'TOM-4C5D')).toEqual({
      attached: false,
      reason: 'already_referred',
    });
  });

  it('never throws, whatever goes wrong', async () => {
    // A referral is a marketing nicety; a signup is the business. This must
    // not be able to fail an account creation.
    codeFindUnique.mockRejectedValue(new Error('database on fire'));

    expect(await attachReferral('newbie', 'SARAH-9F3K')).toEqual({
      attached: false,
      reason: 'error',
    });
  });
});
