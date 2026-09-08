import type { ReferralSubscriptionStatus } from '@prisma/client';
import { db } from './db';
import { config } from './config';
import { discountPercent, maxReferrals, maxPercent, percentStep } from './rules';

/**
 * Reading the program.
 *
 * The one rule that everything else follows from: a referral counts when, and
 * only when, its account is actually paying. `countActiveReferrals` is that
 * rule, and both the dashboard and the Stripe sync call it — so what a referrer
 * is shown and what their invoice does can never disagree.
 */

/**
 * The statuses that earn a referrer their discount.
 *
 * `TRIALING` is excluded unless you opt in, and this is the most consequential
 * line in the module. A trial commits nothing: with trials counted, anyone can
 * open five accounts, start five trials, take 100% off their own subscription
 * and cancel all five before a card is ever charged. With trials excluded, the
 * only way to earn a discount is for real subscriptions to be really paid for,
 * which is not an exploit — it is the program working.
 */
export const COUNTING_STATUSES: ReferralSubscriptionStatus[] = config.REFERRAL_COUNT_TRIALING
  ? ['ACTIVE', 'TRIALING']
  : ['ACTIVE'];

/**
 * How many of this account's referrals currently earn it a discount.
 *
 * Deliberately its own narrow query rather than `listReferrals().filter()`:
 * this runs on every webhook, and it has no use for labels or dates.
 *
 * The two-step (ids, then count) is because these tables carry no relation to
 * join through — see the schema header. Both steps are indexed and the list is
 * bounded by how many people one account has actually invited.
 */
export async function countActiveReferrals(referrerUserId: string): Promise<number> {
  const referrals = await db.referral.findMany({
    where: { referrerUserId },
    select: { referredUserId: true },
  });
  if (referrals.length === 0) return 0;

  return db.referralCustomer.count({
    where: {
      userId: { in: referrals.map((referral) => referral.referredUserId) },
      status: { in: COUNTING_STATUSES },
    },
  });
}

export type ReferralRowStatus = 'active' | 'trialing' | 'pending' | 'lapsed';

export interface ReferralRow {
  id: string;
  label: string;
  joinedAt: Date;
  status: ReferralRowStatus;
  /** Does this row currently contribute to the discount? */
  counts: boolean;
}

/**
 * What a referred account's billing state means to the person who invited it.
 *
 * Four outcomes and not seven, because the difference between `past_due`,
 * `unpaid` and `canceled` is the referrer's business in exactly one respect —
 * they are no longer earning anything for it — and is otherwise a billing
 * detail about someone else's card that they have no right to and cannot act
 * on. `pending` and `lapsed` are separated because they are different news:
 * one has never paid, the other used to.
 */
function rowStatus(status: ReferralSubscriptionStatus): ReferralRowStatus {
  switch (status) {
    case 'ACTIVE':
      return 'active';
    case 'TRIALING':
      return 'trialing';
    case 'NONE':
    case 'INCOMPLETE':
      return 'pending';
    default:
      return 'lapsed';
  }
}

/** Every account this one referred, oldest first. */
export async function listReferrals(referrerUserId: string): Promise<ReferralRow[]> {
  const referrals = await db.referral.findMany({
    where: { referrerUserId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, referredUserId: true, referredLabel: true, createdAt: true },
  });
  if (referrals.length === 0) return [];

  const customers = await db.referralCustomer.findMany({
    where: { userId: { in: referrals.map((referral) => referral.referredUserId) } },
    select: { userId: true, status: true },
  });
  const byUser = new Map(customers.map((customer) => [customer.userId, customer.status]));

  return referrals.map((referral) => {
    // No row at all means the account exists and has never reached checkout,
    // which is the same news as a subscription that never completed.
    const status = byUser.get(referral.referredUserId) ?? 'NONE';
    return {
      id: referral.id,
      label: referral.referredLabel ?? 'A referred account',
      joinedAt: referral.createdAt,
      status: rowStatus(status),
      counts: COUNTING_STATUSES.includes(status),
    };
  });
}

export interface ReferralSummary {
  activeCount: number;
  percent: number;
  /** Referrals still worth something. Zero once the cap is reached. */
  remainingToMax: number;
  maxReferrals: number;
  maxPercent: number;
  percentStep: number;
  /** What this app last told Stripe, for spotting drift on the page itself. */
  appliedPercent: number;
  hasSubscription: boolean;
  currentPeriodEnd: Date | null;
}

/**
 * Everything the referral page needs about the account's own standing.
 *
 * `percent` is what the referrals earn right now; `appliedPercent` is what
 * Stripe was last told. They are equal in every normal state, and showing both
 * is what turns a silent failure to reach Stripe into something visible on the
 * page rather than something discovered on an invoice.
 */
export async function referralSummary(userId: string): Promise<ReferralSummary> {
  const [activeCount, customer] = await Promise.all([
    countActiveReferrals(userId),
    db.referralCustomer.findUnique({
      where: { userId },
      select: {
        appliedPercent: true,
        stripeSubscriptionId: true,
        status: true,
        currentPeriodEnd: true,
      },
    }),
  ]);

  const percent = discountPercent(activeCount);

  return {
    activeCount,
    percent,
    remainingToMax: Math.max(maxReferrals - activeCount, 0),
    maxReferrals,
    maxPercent,
    percentStep,
    appliedPercent: customer?.appliedPercent ?? 0,
    // A discount needs a subscription to sit on. An account on a free plan
    // earns its tier all the same and is told so; there is simply nothing to
    // apply it to until it subscribes.
    hasSubscription: Boolean(
      customer?.stripeSubscriptionId &&
        customer.status !== 'CANCELED' &&
        customer.status !== 'NONE',
    ),
    currentPeriodEnd: customer?.currentPeriodEnd ?? null,
  };
}
