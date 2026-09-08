import { db } from './db';
import { stripeEnabled } from './config';
import { discountPercent } from './rules';
import { countActiveReferrals } from './queries';
import { syncDiscountFor } from './stripe/discount';
import { refreshSubscriptionState } from './stripe/refresh';

/**
 * The safety net.
 *
 * Webhooks are how this program normally learns things, and they are not a
 * memory. An endpoint that was down during a deploy, an event Stripe gave up
 * retrying, a discount write that failed against a Stripe blip: each one leaves
 * a referrer on the wrong tier, and none of them is loud. A wrong discount is a
 * number on an invoice that looks exactly like a right one.
 *
 * So the referral rows are the promise, and the webhook is merely the usual way
 * of keeping it. This sweep recomputes every referrer's tier from those rows and
 * repairs whatever disagrees, on a schedule.
 *
 * Run it from a cron, a queue, or `pnpm referrals:reconcile`. Hourly is plenty;
 * daily is defensible. It only writes when something is actually wrong.
 *
 * Two things it deliberately does:
 *
 *  - **It reports what it repaired.** A silent self-healing sweep hides the
 *    failure it compensates for: if it is quietly fixing twenty discounts a day,
 *    something upstream is broken and somebody needs to know.
 *  - **It re-reads stale mirrors from Stripe**, not just the local arithmetic.
 *    Recomputing from a mirror that itself missed a cancellation would confirm
 *    the wrong answer very confidently.
 */

export interface ReconcileReport {
  /** Accounts whose mirrored Stripe state was re-read because it had gone stale. */
  refreshed: number;
  /** Referrers checked. */
  checked: number;
  /** Referrers whose coupon was wrong and has been corrected. */
  repaired: Array<{ userId: string; from: number; to: number }>;
  /** Referrers still failing to sync, with Stripe's reason. */
  failures: Array<{ userId: string; error: string }>;
}

export interface ReconcileOptions {
  /** Re-read Stripe for mirrors older than this. Default 12 hours. */
  staleAfterMs?: number;
  /** Cap on Stripe re-reads per run, so a big account base stays cheap. */
  refreshLimit?: number;
  /** Report what would change without writing to Stripe. */
  dryRun?: boolean;
}

export async function reconcile(options?: ReconcileOptions): Promise<ReconcileReport> {
  const report: ReconcileReport = { refreshed: 0, checked: 0, repaired: [], failures: [] };
  if (!stripeEnabled) return report;

  const staleAfterMs = options?.staleAfterMs ?? 12 * 60 * 60 * 1000;
  const refreshLimit = options?.refreshLimit ?? 200;

  // Step one: pull anything whose local copy has aged out. A FREE account that
  // never subscribed has nothing to lose or regain and is skipped; a CANCELED
  // one is not, because a reactivation shows up in Stripe first.
  if (!options?.dryRun) {
    const stale = await db.referralCustomer.findMany({
      where: {
        stripeCustomerId: { not: null },
        syncedAt: { lt: new Date(Date.now() - staleAfterMs) },
        status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE', 'INCOMPLETE', 'PAUSED', 'CANCELED'] },
      },
      orderBy: { syncedAt: 'asc' },
      take: refreshLimit,
      select: { userId: true },
    });

    for (const { userId } of stale) {
      try {
        await refreshSubscriptionState(userId);
        report.refreshed += 1;
      } catch (error) {
        // One unreachable customer must not abort the sweep for everyone else.
        report.failures.push({
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Step two: every account that has referred anyone. Distinct rather than one
  // pass per referral row, or a referrer with five referrals is checked five
  // times.
  const referrers = await db.referral.findMany({
    distinct: ['referrerUserId'],
    select: { referrerUserId: true },
  });

  for (const { referrerUserId } of referrers) {
    report.checked += 1;

    const customer = await db.referralCustomer.findUnique({
      where: { userId: referrerUserId },
      select: { appliedPercent: true, stripeSubscriptionId: true, status: true, lastSyncError: true },
    });
    if (!customer?.stripeSubscriptionId || customer.status === 'CANCELED') continue;

    const target = discountPercent(await countActiveReferrals(referrerUserId));
    const drifted = target !== customer.appliedPercent;

    if (!drifted && !customer.lastSyncError) continue;

    if (options?.dryRun) {
      if (drifted) {
        report.repaired.push({ userId: referrerUserId, from: customer.appliedPercent, to: target });
      }
      if (customer.lastSyncError) {
        report.failures.push({ userId: referrerUserId, error: customer.lastSyncError });
      }
      continue;
    }

    const outcome = await syncDiscountFor(referrerUserId);

    if (outcome.changed) {
      report.repaired.push({ userId: referrerUserId, from: outcome.from, to: outcome.to });
    } else if (!outcome.changed && outcome.reason === 'failed') {
      report.failures.push({ userId: referrerUserId, error: outcome.error });
    }
  }

  // Only speaks when it did something. A sweep that logs on every quiet run
  // trains everyone to ignore it, which is how the noisy day gets missed too.
  if (report.repaired.length > 0 || report.failures.length > 0) {
    console.warn(
      `[referrals] reconcile repaired ${report.repaired.length} discount(s), ` +
        `${report.failures.length} still failing, ${report.refreshed} refreshed from Stripe.`,
    );
  }

  return report;
}
