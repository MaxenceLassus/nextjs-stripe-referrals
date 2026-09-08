import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/demo/session';
import { db } from '@/referrals/db';
import { referralSummary } from '@/referrals/queries';
import { stripeEnabled } from '@/referrals/config';

export const dynamic = 'force-dynamic';

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Paying',
  TRIALING: 'On trial',
  PAST_DUE: 'Payment failed',
  CANCELED: 'Cancelled',
  PAUSED: 'Paused',
  INCOMPLETE: 'Checkout never completed',
  NONE: 'Free plan',
};

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect('/signup');

  const [customer, summary] = await Promise.all([
    db.referralCustomer.findUnique({ where: { userId: user.id } }),
    referralSummary(user.id),
  ]);

  const status = customer?.status ?? 'NONE';

  return (
    <main className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{user.name || user.email}</h1>
          <p className="mt-1 text-sm text-slate-500">Signed in as {user.email}</p>
        </div>
        <Link href="/" className="text-sm text-slate-500 underline">
          Switch account
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Subscription</h2>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1 font-medium">{STATUS_TEXT[status] ?? status}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Earning</dt>
            <dd className="mt-1 font-medium">{summary.percent}% off</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">On Stripe</dt>
            <dd className="mt-1 font-medium">{summary.appliedPercent}% off</dd>
          </div>
        </dl>

        {customer?.lastSyncError && (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            Last discount sync failed: {customer.lastSyncError}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {stripeEnabled && status !== 'ACTIVE' && status !== 'TRIALING' && (
            <form action="/api/demo/checkout" method="post">
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                Subscribe
              </button>
            </form>
          )}

          {stripeEnabled && customer?.stripeCustomerId && (
            <form action="/api/demo/refresh" method="post">
              <button
                type="submit"
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Pull state from Stripe
              </button>
            </form>
          )}

          <Link
            href="/dashboard/referrals"
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Referrals
          </Link>
        </div>
      </section>
    </main>
  );
}
