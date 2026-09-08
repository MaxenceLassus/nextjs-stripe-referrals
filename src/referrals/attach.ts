import { db } from './db';
import { resolveReferrer } from './codes';
import { syncDiscountFor } from './stripe/discount';

/**
 * Record that an account was referred. The one call your signup path must make.
 *
 * Call it once, immediately after you create the account, and pass whatever
 * code you captured from the `?ref=` link (`readReferralCookie()` gets it back
 * for you). Everything after that — counting, coupons, invoices — happens on
 * its own.
 *
 * Three properties this function is built around:
 *
 *  - **It never throws.** A referral is a marketing nicety and a signup is the
 *    business. A code that is stale, mistyped, self-referring or attached to a
 *    deleted account must not be the reason someone cannot create an account,
 *    so every outcome comes back as a result you may log and ignore.
 *
 *  - **It refuses an account that has already been a customer.** Otherwise the
 *    call could be replayed later against an established account, and referrals
 *    would be attributable retroactively — which is the one way to earn a
 *    discount here without anybody new ever paying.
 *
 *  - **It re-validates the code against the database.** What arrives here came
 *    from a cookie or a form field, both of which the visitor controls. That is
 *    harmless (crediting a referral only ever *gives* someone a discount, so
 *    there is nothing to steal by forging one) but it is not evidence, and the
 *    code is looked up rather than trusted.
 */
export type AttachResult =
  | { attached: true; referrerUserId: string }
  | {
      attached: false;
      reason: 'no_code' | 'unknown_code' | 'self_referral' | 'already_referred' | 'already_customer' | 'error';
    };

export async function attachReferral(
  referredUserId: string,
  code: string | null | undefined,
  options?: { label?: string | null },
): Promise<AttachResult> {
  try {
    if (!code?.trim()) return { attached: false, reason: 'no_code' };

    const referrerUserId = await resolveReferrer(code, referredUserId);
    if (!referrerUserId) {
      // Both cases are deliberately not distinguished to the caller's caller:
      // see resolveReferrer. Split here only so your logs can tell them apart.
      const selfOwned = await db.referralCode.findUnique({
        where: { code: code.trim().toUpperCase() },
        select: { userId: true },
      });
      return {
        attached: false,
        reason: selfOwned?.userId === referredUserId ? 'self_referral' : 'unknown_code',
      };
    }

    const priorCustomer = await db.referralCustomer.findUnique({
      where: { userId: referredUserId },
      select: { status: true },
    });
    if (priorCustomer && priorCustomer.status !== 'NONE') {
      return { attached: false, reason: 'already_customer' };
    }

    await db.referral.create({
      data: {
        referrerUserId,
        referredUserId,
        referredLabel: options?.label?.slice(0, 120) ?? null,
      },
    });

    // The referred account is brand new and pays nothing yet, so this changes
    // the referrer's tier only in the rare case where their stored discount had
    // drifted. It costs one indexed count and no Stripe call when nothing moved,
    // and it means the referrer's page is right the moment they refresh it.
    await syncDiscountFor(referrerUserId);

    return { attached: true, referrerUserId };
  } catch (error) {
    // The unique constraint on referredUserId is the expected failure here: two
    // signup requests raced, or the caller replayed. Either way the account is
    // already attributed and there is nothing to fix.
    if ((error as { code?: string } | null)?.code === 'P2002') {
      return { attached: false, reason: 'already_referred' };
    }

    console.error('[referrals] attachReferral failed:', error);
    return { attached: false, reason: 'error' };
  }
}

/**
 * Erase an account from the program. Call it from your own account-deletion
 * path.
 *
 * Necessary because these tables carry no foreign key to your users table, so
 * nothing cascades on its own (see the schema header for why that trade was
 * made). Deleting the referral rows this account *made* also drops whatever
 * discount it was earning; deleting the row that records who referred *it*
 * lowers its referrer's tier, so that referrer is resynced here rather than
 * being left holding a discount for an account that no longer exists.
 */
export async function forgetUser(userId: string): Promise<void> {
  const referredBy = await db.referral.findUnique({
    where: { referredUserId: userId },
    select: { referrerUserId: true },
  });

  await db.$transaction([
    db.referral.deleteMany({ where: { referrerUserId: userId } }),
    db.referral.deleteMany({ where: { referredUserId: userId } }),
    db.referralCode.deleteMany({ where: { userId } }),
    db.referralCustomer.deleteMany({ where: { userId } }),
  ]);

  if (referredBy) await syncDiscountFor(referredBy.referrerUserId);
}
